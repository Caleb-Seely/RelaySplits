# Incremental Caching Strategy for Leaderboard

## 🎯 **Core Concept**

Instead of recalculating all teams every time, we:
1. **Cache individual team projections** with timestamps
2. **Track what changed** using existing `updated_at` fields
3. **Only recalculate affected teams** when data changes
4. **Merge cached + recalculated** for final leaderboard

---

## 🏗️ **Database Schema for Caching**

### **1. Leaderboard Cache Table**
```sql
-- Create leaderboard cache table
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  projected_finish_time BIGINT, -- Unix timestamp
  current_leg INTEGER,
  progress_percentage DECIMAL(5,2),
  next_exchange_leg INTEGER,
  next_exchange_time BIGINT,
  current_runner_name TEXT,
  current_runner_leg INTEGER,
  distance_remaining DECIMAL(5,2),
  estimated_finish BIGINT,
  status TEXT CHECK (status IN ('active', 'dnf', 'finished', 'not_started')),
  dnf_reason TEXT,
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_version TEXT, -- Hash of input data for change detection
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_leaderboard_cache_projected_finish ON leaderboard_cache(projected_finish_time);
CREATE INDEX idx_leaderboard_cache_status ON leaderboard_cache(status);
CREATE INDEX idx_leaderboard_cache_last_calculated ON leaderboard_cache(last_calculated_at);

-- Trigger for updated_at
CREATE TRIGGER update_leaderboard_cache_updated_at 
  BEFORE UPDATE ON leaderboard_cache 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### **2. Change Tracking Table**
```sql
-- Track what data has changed since last calculation
CREATE TABLE IF NOT EXISTS leaderboard_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('runner_update', 'leg_update', 'team_update')),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient change detection
CREATE INDEX idx_leaderboard_change_log_team_processed ON leaderboard_change_log(team_id, processed);
CREATE INDEX idx_leaderboard_change_log_changed_at ON leaderboard_change_log(changed_at);
```

---

## 🔄 **Incremental Update Process**

### **1. Change Detection Query**
```sql
-- Function to detect teams with recent changes
CREATE OR REPLACE FUNCTION get_teams_with_changes(since_timestamp TIMESTAMP WITH TIME ZONE)
RETURNS TABLE(team_id UUID, last_change TIMESTAMP WITH TIME ZONE) AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT t.id, GREATEST(
    t.updated_at,
    COALESCE(MAX(r.updated_at), '1970-01-01'::timestamptz),
    COALESCE(MAX(l.updated_at), '1970-01-01'::timestamptz)
  ) as last_change
  FROM teams t
  LEFT JOIN runners r ON t.id = r.team_id
  LEFT JOIN legs l ON t.id = l.team_id
  WHERE t.updated_at > since_timestamp
     OR r.updated_at > since_timestamp
     OR l.updated_at > since_timestamp
  GROUP BY t.id, t.updated_at
  HAVING GREATEST(
    t.updated_at,
    COALESCE(MAX(r.updated_at), '1970-01-01'::timestamptz),
    COALESCE(MAX(l.updated_at), '1970-01-01'::timestamptz)
  ) > since_timestamp;
END;
$$ LANGUAGE plpgsql;
```

### **2. Data Version Hash Function**
```sql
-- Function to generate hash of team's input data
CREATE OR REPLACE FUNCTION calculate_team_data_version(team_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  data_hash TEXT;
BEGIN
  SELECT encode(
    digest(
      CONCAT(
        COALESCE(t.updated_at::text, ''),
        COALESCE(string_agg(r.updated_at::text || r.pace::text, '|' ORDER BY r.id), ''),
        COALESCE(string_agg(l.updated_at::text || l.finish_time::text, '|' ORDER BY l.number), '')
      ),
      'sha256'
    ),
    'hex'
  ) INTO data_hash
  FROM teams t
  LEFT JOIN runners r ON t.id = r.team_id
  LEFT JOIN legs l ON t.id = l.team_id
  WHERE t.id = team_uuid
  GROUP BY t.id, t.updated_at;
  
  RETURN data_hash;
END;
$$ LANGUAGE plpgsql;
```

---

## ⚡ **Optimized Edge Function**

### **1. Incremental Leaderboard Function**
```typescript
// supabase/functions/leaderboard-data/index.ts
interface IncrementalUpdateRequest {
  last_update?: string; // ISO timestamp of last update
  force_refresh?: boolean; // Force full recalculation
}

interface IncrementalUpdateResponse {
  teams: LeaderboardTeam[];
  updated_teams: string[]; // Team IDs that were recalculated
  cached_teams: string[]; // Team IDs that used cached data
  last_updated: string;
  meta: {
    calculation_time_ms: number;
    cache_hit_rate: number;
    teams_recalculated: number;
    teams_cached: number;
  };
}

serve(async (req) => {
  const { last_update, force_refresh = false }: IncrementalUpdateRequest = await req.json();
  
  const startTime = performance.now();
  let teamsRecalculated = 0;
  let teamsCached = 0;
  
  try {
    // 1. Get all cached team projections
    const { data: cachedTeams } = await supabase
      .from('leaderboard_cache')
      .select('*')
      .order('projected_finish_time', { ascending: true });
    
    if (force_refresh || !last_update) {
      // Full recalculation
      const allTeams = await recalculateAllTeams();
      teamsRecalculated = allTeams.length;
      
      return {
        teams: allTeams,
        updated_teams: allTeams.map(t => t.id),
        cached_teams: [],
        last_updated: new Date().toISOString(),
        meta: {
          calculation_time_ms: performance.now() - startTime,
          cache_hit_rate: 0,
          teams_recalculated: teamsRecalculated,
          teams_cached: 0
        }
      };
    }
    
    // 2. Check for teams with recent changes
    const lastUpdateTime = new Date(last_update);
    const { data: changedTeams } = await supabase
      .rpc('get_teams_with_changes', { since_timestamp: lastUpdateTime.toISOString() });
    
    const updatedTeamIds = new Set(changedTeams?.map(t => t.team_id) || []);
    const updatedTeams: LeaderboardTeam[] = [];
    const finalTeams: LeaderboardTeam[] = [];
    
    // 3. Process each team
    for (const cachedTeam of cachedTeams || []) {
      if (updatedTeamIds.has(cachedTeam.team_id)) {
        // Recalculate this team
        const recalculatedTeam = await recalculateTeamProjection(cachedTeam.team_id);
        updatedTeams.push(recalculatedTeam);
        teamsRecalculated++;
      } else {
        // Use cached data
        finalTeams.push(cachedTeam);
        teamsCached++;
      }
    }
    
    // 4. Add newly recalculated teams
    finalTeams.push(...updatedTeams);
    
    // 5. Sort by projected finish time
    finalTeams.sort((a, b) => (a.projected_finish_time || 0) - (b.projected_finish_time || 0));
    
    return {
      teams: finalTeams,
      updated_teams: updatedTeams.map(t => t.id),
      cached_teams: cachedTeams?.filter(t => !updatedTeamIds.has(t.team_id)).map(t => t.team_id) || [],
      last_updated: new Date().toISOString(),
      meta: {
        calculation_time_ms: performance.now() - startTime,
        cache_hit_rate: teamsCached / (teamsCached + teamsRecalculated),
        teams_recalculated: teamsRecalculated,
        teams_cached: teamsCached
      }
    };
    
  } catch (error) {
    console.error('Incremental leaderboard error:', error);
    throw error;
  }
});
```

### **2. Team Recalculation Function**
```typescript
async function recalculateTeamProjection(teamId: string): Promise<LeaderboardTeam> {
  // 1. Fetch team data
  const { data: teamData } = await supabase
    .from('teams')
    .select(`
      id,
      name,
      start_time,
      runners (
        id,
        name,
        pace,
        van
      ),
      legs (
        id,
        number,
        runner_id,
        distance,
        start_time,
        finish_time
      )
    `)
    .eq('id', teamId)
    .single();
  
  // 2. Calculate projection
  const projection = calculateTeamProjection(teamData);
  
  // 3. Update cache
  const dataVersion = await calculateDataVersion(teamData);
  
  await supabase
    .from('leaderboard_cache')
    .upsert({
      team_id: teamId,
      projected_finish_time: projection.projected_finish_time,
      current_leg: projection.current_leg,
      progress_percentage: projection.progress_percentage,
      next_exchange_leg: projection.next_exchange.leg_number,
      next_exchange_time: projection.next_exchange.projected_time,
      current_runner_name: projection.current_runner?.name,
      current_runner_leg: projection.current_runner?.leg_number,
      distance_remaining: projection.current_runner?.distance_remaining,
      estimated_finish: projection.current_runner?.estimated_finish,
      status: projection.status,
      dnf_reason: projection.dnf_reason,
      data_version: dataVersion,
      last_calculated_at: new Date().toISOString()
    });
  
  return projection;
}
```

---

## 📊 **Performance Benefits**

### **Before (Full Recalculation)**
```
1000 teams × 50ms calculation = 50 seconds
Database queries: 1000 × 3 tables = 3000 queries
Memory usage: 100% of all team data
```

### **After (Incremental)**
```
Typical race: 5-10 teams changed × 50ms = 250-500ms
Database queries: 5-10 × 3 tables = 15-30 queries
Memory usage: 1% of all team data
Cache hit rate: 99%+
```

### **Performance Improvements**
- **Response Time**: 50s → 500ms (**99% faster**)
- **Database Load**: 3000 → 30 queries (**99% reduction**)
- **Memory Usage**: 100% → 1% (**99% reduction**)
- **Scalability**: 1000 teams → 10,000+ teams

---

## 🔄 **Real-Time Integration**

### **1. Change Detection Triggers**
```sql
-- Trigger to log changes for leaderboard cache invalidation
CREATE OR REPLACE FUNCTION log_leaderboard_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO leaderboard_change_log (
    team_id,
    change_type,
    table_name,
    record_id
  ) VALUES (
    COALESCE(NEW.team_id, OLD.team_id),
    CASE 
      WHEN TG_TABLE_NAME = 'runners' THEN 'runner_update'
      WHEN TG_TABLE_NAME = 'legs' THEN 'leg_update'
      WHEN TG_TABLE_NAME = 'teams' THEN 'team_update'
    END,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all relevant tables
CREATE TRIGGER log_runner_changes 
  AFTER INSERT OR UPDATE OR DELETE ON runners 
  FOR EACH ROW EXECUTE FUNCTION log_leaderboard_change();

CREATE TRIGGER log_leg_changes 
  AFTER INSERT OR UPDATE OR DELETE ON legs 
  FOR EACH ROW EXECUTE FUNCTION log_leaderboard_change();

CREATE TRIGGER log_team_changes 
  AFTER INSERT OR UPDATE OR DELETE ON teams 
  FOR EACH ROW EXECUTE FUNCTION log_leaderboard_change();
```

### **2. Cache Invalidation**
```typescript
// Invalidate cache when race events occur
export async function invalidateTeamCache(teamId: string) {
  await supabase
    .from('leaderboard_cache')
    .delete()
    .eq('team_id', teamId);
}

// Batch invalidate multiple teams
export async function invalidateTeamsCache(teamIds: string[]) {
  await supabase
    .from('leaderboard_cache')
    .delete()
    .in('team_id', teamIds);
}
```

---

## 🎯 **Client-Side Implementation**

### **1. Smart Refresh Hook**
```typescript
// src/hooks/useLeaderboard.ts
export const useLeaderboard = () => {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', lastUpdate],
    queryFn: () => fetchIncrementalLeaderboard({ last_update: lastUpdate }),
    refetchInterval: calculateRefreshInterval(),
    staleTime: 30000,
  });
  
  // Update last update timestamp
  useEffect(() => {
    if (data?.last_updated) {
      setLastUpdate(data.last_updated);
    }
  }, [data?.last_updated]);
  
  return { data, isLoading, error };
};
```

### **2. Adaptive Refresh**
```typescript
function calculateRefreshInterval(): number {
  const now = Date.now();
  const raceStart = getRaceStartTime();
  const isActiveHours = isDuringActiveRaceHours(now, raceStart);
  const recentActivity = getRecentRaceActivity();
  
  if (isActiveHours && recentActivity > 10) {
    return 30 * 1000; // 30 seconds during high activity
  } else if (isActiveHours) {
    return 60 * 1000; // 1 minute during normal activity
  } else {
    return 5 * 60 * 1000; // 5 minutes during low activity
  }
}
```

---

## ✅ **Is This Possible with Current DB Design?**

**Absolutely YES!** The current database design is perfect for this because:

1. **✅ `updated_at` timestamps** on all tables
2. **✅ Automatic triggers** update timestamps on changes
3. **✅ Team-based structure** with clear relationships
4. **✅ Proper indexes** for efficient queries
5. **✅ RLS policies** already in place

## 🚀 **Implementation Priority**

### **Phase 1: Core Infrastructure**
1. Create `leaderboard_cache` table
2. Create `leaderboard_change_log` table
3. Add change detection functions
4. Implement basic incremental updates

### **Phase 2: Optimization**
1. Add data version hashing
2. Implement smart cache invalidation
3. Add real-time change triggers
4. Optimize queries and indexes

### **Phase 3: Advanced Features**
1. Adaptive refresh intervals
2. Batch processing for large changes
3. Cache warming strategies
4. Performance monitoring

This incremental approach transforms the leaderboard from a slow, resource-intensive operation into a lightning-fast, scalable system that can handle thousands of teams efficiently!
