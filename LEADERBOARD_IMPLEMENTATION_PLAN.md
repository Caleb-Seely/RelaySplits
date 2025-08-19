# RelaySplits Leaderboard - Implementation Plan

## 📋 **Executive Summary**

This implementation plan provides a logical, prioritized roadmap for building the leaderboard feature. The plan focuses on **core functionality first**, then **optimization**, and finally **polish**.

**Timeline**: 4 weeks total
**Team Size**: 1-2 developers
**Priority**: Core functionality → Performance → Real-time → Polish

---

## 🎯 **Implementation Phases Overview**

```
Week 1: Core Foundation     Week 2: Performance & Real-time
├── Database Schema         ├── Caching Layer
├── Basic API              ├── Real-time Subscriptions  
├── Simple UI              ├── Incremental Updates
├── Security               ├── Virtual Scrolling
└── Error Boundaries       └── Data Consistency

Week 3: Optimization        Week 4: Polish & Monitoring
├── Advanced Caching       ├── Accessibility
├── Error Handling         ├── Performance Monitoring
├── Health Checks          ├── Graceful Degradation
└── Security Hardening     └── Final Testing
```

---

## 🏗️ **Phase 1: Core Foundation (Week 1)**

### **Day 1-2: Database & Backend Foundation**

#### **1.1 Database Schema Setup**
```sql
-- Priority: CRITICAL
-- Estimated Time: 4 hours

-- Create leaderboard cache table
CREATE TABLE IF NOT EXISTS leaderboard_cache (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  projected_finish_time BIGINT,
  current_leg INTEGER,
  progress_percentage DECIMAL(5,2),
  next_exchange_leg INTEGER,
  next_exchange_time BIGINT,
  current_runner_name TEXT,
  status TEXT CHECK (status IN ('active', 'dnf', 'finished', 'not_started')),
  last_calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_leaderboard_cache_projected_finish ON leaderboard_cache(projected_finish_time);
CREATE INDEX idx_leaderboard_cache_status ON leaderboard_cache(status);
CREATE INDEX idx_leaderboard_cache_last_calculated ON leaderboard_cache(last_calculated_at);

-- Enable RLS for security
ALTER TABLE leaderboard_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "leaderboard_public_read" ON leaderboard_cache FOR SELECT USING (true);
```

#### **1.2 Basic Edge Function**
```typescript
// Priority: CRITICAL
// Estimated Time: 6 hours
// File: supabase/functions/leaderboard-data/index.ts

interface LeaderboardRequest {
  last_update?: string;
  force_refresh?: boolean;
}

interface LeaderboardResponse {
  teams: LeaderboardTeam[];
  last_updated: string;
  meta: {
    calculation_time_ms: number;
    teams_count: number;
  };
}

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { last_update, force_refresh = false }: LeaderboardRequest = await req.json();
    
    // Basic rate limiting (simple IP-based)
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    if (!await checkRateLimit(clientIP)) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Get all teams with basic projection calculation
    const teams = await calculateAllTeamProjections();
    
    return new Response(
      JSON.stringify({
        teams,
        last_updated: new Date().toISOString(),
        meta: {
          calculation_time_ms: 0, // Will implement timing later
          teams_count: teams.length
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

#### **1.3 Basic Projection Calculation**
```typescript
// Priority: CRITICAL
// Estimated Time: 4 hours
// File: src/utils/leaderboardProjections.ts

export async function calculateAllTeamProjections(): Promise<LeaderboardTeam[]> {
  const { data: teams } = await supabase
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
    `);

  if (!teams) return [];

  return teams.map(team => calculateTeamProjection(team)).filter(Boolean);
}

export function calculateTeamProjection(team: any): LeaderboardTeam | null {
  if (!team.name || !team.runners || !team.legs) {
    return null;
  }

  // Calculate current progress
  const completedLegs = team.legs.filter((leg: any) => leg.finish_time);
  const currentLeg = completedLegs.length + 1;
  const progressPercentage = (completedLegs.length / team.legs.length) * 100;

  // Calculate projected finish time
  const projectedFinishTime = calculateProjectedFinish(team);

  return {
    id: team.id,
    name: team.name,
    projected_finish_time: projectedFinishTime,
    current_leg,
    progress_percentage: Math.round(progressPercentage * 100) / 100,
    next_exchange_leg: currentLeg + 1,
    next_exchange_time: calculateNextExchangeTime(team, currentLeg),
    current_runner_name: getCurrentRunnerName(team, currentLeg),
    status: determineTeamStatus(team),
    last_calculated_at: new Date().toISOString()
  };
}
```

### **Day 3-4: Frontend Foundation**

#### **2.1 Basic Leaderboard Page**
```typescript
// Priority: CRITICAL
// Estimated Time: 6 hours
// File: src/pages/Leaderboard.tsx

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLeaderboardData } from '@/services/leaderboard';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export const LeaderboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboardData,
    refetchInterval: 60000, // 1 minute refresh
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Race Leaderboard</h1>
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Race Leaderboard</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading leaderboard. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">Race Leaderboard</h1>
      <LeaderboardTable teams={data?.teams || []} />
    </div>
  );
};
```

#### **2.2 Basic Leaderboard Table**
```typescript
// Priority: CRITICAL
// Estimated Time: 4 hours
// File: src/components/leaderboard/LeaderboardTable.tsx

interface LeaderboardTableProps {
  teams: LeaderboardTeam[];
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ teams }) => {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Progress
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Runner
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Projected Finish
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {teams.map((team, index) => (
            <tr key={team.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {index + 1}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {team.name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${team.progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {team.progress_percentage}%
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {team.current_runner_name || 'N/A'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatFinishTime(team.projected_finish_time)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

### **Day 5: Routing & Integration**

#### **3.1 Add Route**
```typescript
// Priority: CRITICAL
// Estimated Time: 2 hours
// File: src/App.tsx

// Add to existing routes
{
  path: '/leaderboard',
  element: <LeaderboardPage />
}
```

#### **3.2 Navigation Link**
```typescript
// Priority: CRITICAL
// Estimated Time: 1 hour
// Add to navigation menu
<Link to="/leaderboard" className="nav-link">
  Leaderboard
</Link>
```

### **Day 5 (Extended): Error Boundaries & Data Consistency**

#### **3.3 Error Boundary Implementation**
```typescript
// Priority: CRITICAL
// Estimated Time: 3 hours
// File: src/components/ErrorBoundary.tsx

export class LeaderboardErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Leaderboard error:', error, errorInfo);
    this.reportError(error, errorInfo);
  }
  
  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    // Send to monitoring service
    if (window.gtag) {
      window.gtag('event', 'exception', {
        description: error.message,
        fatal: false
      });
    }
  }
  
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="text-red-800 font-medium">Something went wrong</h3>
          <p className="text-red-600 text-sm mt-1">
            The leaderboard encountered an error. Please refresh the page.
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-3 py-1 bg-red-600 text-white rounded text-sm"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}
```

#### **3.4 Data Consistency Manager**
```typescript
// Priority: CRITICAL
// Estimated Time: 4 hours
// File: src/utils/dataConsistency.ts

export class DataConsistencyManager {
  private processingTeams = new Set<string>();
  private locks = new Map<string, Promise<any>>();
  
  async withTeamLock<T>(teamId: string, operation: () => Promise<T>): Promise<T> {
    if (this.processingTeams.has(teamId)) {
      throw new Error(`Team ${teamId} is currently being updated`);
    }
    
    this.processingTeams.add(teamId);
    
    try {
      return await operation();
    } finally {
      this.processingTeams.delete(teamId);
    }
  }
  
  async validateDataIntegrity(teamId: string): Promise<ValidationResult> {
    const { data: team } = await supabase
      .from('teams')
      .select(`
        id,
        runners (id, name),
        legs (id, number, runner_id)
      `)
      .eq('id', teamId)
      .single();
    
    const issues: string[] = [];
    
    // Check for orphaned legs
    const runnerIds = new Set(team.runners.map((r: any) => r.id));
    const orphanedLegs = team.legs.filter((l: any) => !runnerIds.has(l.runner_id));
    
    if (orphanedLegs.length > 0) {
      issues.push(`Found ${orphanedLegs.length} legs assigned to non-existent runners`);
    }
    
    // Check for duplicate leg numbers
    const legNumbers = team.legs.map((l: any) => l.number);
    const duplicateNumbers = legNumbers.filter((num, index) => legNumbers.indexOf(num) !== index);
    
    if (duplicateNumbers.length > 0) {
      issues.push(`Found duplicate leg numbers: ${duplicateNumbers.join(', ')}`);
    }
    
    return {
      isValid: issues.length === 0,
      issues,
      warnings: []
    };
  }
  
  async repairDataIntegrity(teamId: string): Promise<RepairResult> {
    const validation = await this.validateDataIntegrity(teamId);
    
    if (validation.isValid) {
      return { repaired: false, message: 'No repairs needed' };
    }
    
    // Attempt to repair common issues
    const repairs: string[] = [];
    
    // Remove orphaned legs
    if (validation.issues.some(issue => issue.includes('orphaned'))) {
      await supabase
        .from('legs')
        .delete()
        .eq('team_id', teamId)
        .is('runner_id', null);
      repairs.push('Removed orphaned legs');
    }
    
    return {
      repaired: repairs.length > 0,
      repairs,
      message: repairs.length > 0 ? `Repaired: ${repairs.join(', ')}` : 'Unable to repair automatically'
    };
  }
}
```

---

## ⚡ **Phase 2: Performance & Real-time (Week 2)**

### **Day 6-7: Caching Layer**

#### **4.1 Incremental Caching Implementation**
```typescript
// Priority: HIGH
// Estimated Time: 8 hours
// File: src/services/leaderboardCache.ts

export class LeaderboardCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number; version: string }>();
  
  // Add data version tracking
  async set(key: string, data: any, ttl: number, dataVersion?: string): Promise<void> {
    const version = dataVersion || this.generateDataVersion(data);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version
    });
  }
  
  // Check if cached data is still valid
  async isStale(key: string, currentVersion: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return true;
    
    return item.version !== currentVersion;
  }
  
  // Force recalculation when data changes
  async invalidateOnDataChange(teamId: string, changeType: 'leg' | 'runner' | 'team'): Promise<void> {
    // Invalidate all related cache entries
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(teamId) || key === 'full_leaderboard'
    );
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // Log invalidation for debugging
    console.log(`Cache invalidated for team ${teamId} due to ${changeType} change`);
  }
}
```

#### **4.2 Incremental Update Logic**
```typescript
// Priority: HIGH
// Estimated Time: 6 hours
// File: src/services/leaderboardIncremental.ts

export async function getIncrementalLeaderboard(lastUpdate?: string): Promise<LeaderboardResponse> {
  const startTime = performance.now();
  
  // Get cached data
  const cachedData = await leaderboardCache.get('full_leaderboard');
  
  if (!lastUpdate && cachedData) {
    return {
      ...cachedData,
      meta: {
        ...cachedData.meta,
        cache_hit: true
      }
    };
  }
  
  // Check for teams with recent changes
  const changedTeams = await getTeamsWithChanges(lastUpdate);
  
  if (changedTeams.length === 0 && cachedData) {
    return {
      ...cachedData,
      meta: {
        ...cachedData.meta,
        cache_hit: true
      }
    };
  }
  
  // Recalculate only changed teams
  const updatedTeams = await Promise.all(
    changedTeams.map(teamId => recalculateTeamProjection(teamId))
  );
  
  // Merge with cached data
  const finalTeams = mergeTeamData(cachedData?.teams || [], updatedTeams);
  
  const result = {
    teams: finalTeams,
    last_updated: new Date().toISOString(),
    meta: {
      calculation_time_ms: performance.now() - startTime,
      cache_hit: false,
      teams_recalculated: changedTeams.length
    }
  };
  
  // Update cache
  await leaderboardCache.set('full_leaderboard', result, 30000); // 30s TTL
  
  return result;
}
```

### **Day 8-9: Real-time Integration**

#### **5.1 Global Leaderboard Channel**
```typescript
// Priority: HIGH
// Estimated Time: 4 hours
// Add to existing Edge Functions

// In legs-upsert/index.ts and runners-upsert/index.ts
await supabase.channel('leaderboard-global').send({
  type: 'broadcast',
  event: 'team_updated',
  payload: { 
    team_id: teamId, 
    change_type: 'leg_update',
    timestamp: new Date().toISOString()
  }
});
```

#### **5.2 Real-time Hook**
```typescript
// Priority: HIGH
// Estimated Time: 6 hours
// File: src/hooks/useLeaderboardRealtime.ts

export const useLeaderboardRealtime = () => {
  const [subscription, setSubscription] = useState(null);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Batch updates to prevent thrashing
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const BATCH_DELAY = 1000; // 1 second delay
  
  const processBatchedUpdates = useCallback(() => {
    if (pendingUpdates.size > 0) {
      const teamIds = Array.from(pendingUpdates);
      
      // Invalidate cache for all changed teams
      teamIds.forEach(teamId => {
        leaderboardCache.invalidateTeam(teamId);
      });
      
      // Trigger single query invalidation
      queryClient.invalidateQueries(['leaderboard']);
      
      // Clear pending updates
      setPendingUpdates(new Set());
      
      console.log(`Processed ${teamIds.length} batched updates`);
    }
  }, [pendingUpdates, queryClient]);
  
  useEffect(() => {
    const channel = supabase.channel('leaderboard-global')
      .on('broadcast', { event: 'team_updated' }, (payload) => {
        const { team_id, change_type, timestamp } = payload.payload;
        
        // Add to pending updates
        setPendingUpdates(prev => new Set([...prev, team_id]));
        
        // Clear existing timeout
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }
        
        // Set new timeout for batching
        batchTimeoutRef.current = setTimeout(processBatchedUpdates, BATCH_DELAY);
        
        setLastUpdate(timestamp);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Leaderboard real-time subscription active');
        } else if (status === 'CLOSED') {
          console.warn('Leaderboard real-time subscription closed');
        }
      });
    
    setSubscription(channel);
    
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [processBatchedUpdates]);
  
  return { subscription, lastUpdate, pendingUpdatesCount: pendingUpdates.size };
};
```

### **Day 10: Virtual Scrolling & Data Consistency Integration**

#### **6.1 Virtual Scrolling Implementation**
```typescript
// Priority: MEDIUM
// Estimated Time: 6 hours
// File: src/components/leaderboard/VirtualizedLeaderboard.tsx

import { FixedSizeList as List } from 'react-window';

export const VirtualizedLeaderboard: React.FC<{ teams: LeaderboardTeam[] }> = ({ teams }) => {
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <TeamRow team={teams[index]} rank={index + 1} />
    </div>
  );

  return (
    <List
      height={600}
      itemCount={teams.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

#### **6.2 Data Consistency Integration**
```typescript
// Priority: CRITICAL
// Estimated Time: 2 hours
// File: src/components/leaderboard/LeaderboardTable.tsx

// Update existing LeaderboardTable to use data consistency manager
export const LeaderboardTable: React.FC<{ teams: LeaderboardTeam[] }> = ({ teams }) => {
  const dataConsistencyManager = useMemo(() => new DataConsistencyManager(), []);
  
  // Validate data integrity on mount
  useEffect(() => {
    const validateTeams = async () => {
      for (const team of teams) {
        const validation = await dataConsistencyManager.validateDataIntegrity(team.id);
        if (!validation.isValid) {
          console.warn(`Data integrity issues for team ${team.name}:`, validation.issues);
          
          // Attempt automatic repair
          const repair = await dataConsistencyManager.repairDataIntegrity(team.id);
          if (repair.repaired) {
            console.log(`Repaired data for team ${team.name}:`, repair.repairs);
          }
        }
      }
    };
    
    validateTeams();
  }, [teams, dataConsistencyManager]);
  
  // Wrap team updates with consistency locks
  const handleTeamUpdate = useCallback(async (teamId: string, updateFn: () => Promise<void>) => {
    await dataConsistencyManager.withTeamLock(teamId, updateFn);
  }, [dataConsistencyManager]);
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        {/* ... existing table structure ... */}
      </table>
    </div>
  );
};
```

---

## 🔧 **Phase 3: Optimization (Week 3)**

### **Day 11-12: Advanced Caching**

#### **7.1 Redis Integration**
```typescript
// Priority: MEDIUM
// Estimated Time: 8 hours
// File: src/services/redisCache.ts

import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL
});

export class RedisLeaderboardCache {
  async get(key: string): Promise<any | null> {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }
  
  async set(key: string, data: any, ttl: number): Promise<void> {
    try {
      await redis.setEx(key, ttl / 1000, JSON.stringify(data));
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }
  
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (error) {
      console.error('Redis invalidate error:', error);
    }
  }
}
```

### **Day 13-14: Error Handling, Health Checks & Security Hardening**

#### **8.1 Circuit Breaker**
```typescript
// Priority: MEDIUM
// Estimated Time: 6 hours
// File: src/utils/circuitBreaker.ts

export class CircuitBreaker {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  
  private readonly threshold = 5;
  private readonly timeout = 60000;
  
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.timeout) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit breaker is OPEN');
      }
    }
    
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.failures >= this.threshold) {
      this.state = 'OPEN';
    }
  }
}
```

#### **8.2 Health Monitoring**
```typescript
// Priority: MEDIUM
// Estimated Time: 4 hours
// File: src/utils/healthCheck.ts

export class HealthChecker {
  async checkDatabase(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      await supabase.from('teams').select('count').limit(1);
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
  
  async checkCache(): Promise<HealthStatus> {
    try {
      const start = Date.now();
      await redis.ping();
      const responseTime = Date.now() - start;
      
      return {
        status: 'healthy',
        responseTime,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

#### **8.3 Security Hardening**
```typescript
// Priority: HIGH
// Estimated Time: 4 hours
// File: src/utils/security.ts

export class SecurityManager {
  // Input sanitization
  static sanitizeInput(input: string): string {
    return input
      .replace(/[<>]/g, '') // Remove potential HTML
      .trim()
      .substring(0, 1000); // Limit length
  }
  
  // Rate limiting on client side
  static createClientRateLimiter(maxRequests: number, windowMs: number) {
    const requests = new Map<string, number[]>();
    
    return (key: string): boolean => {
      const now = Date.now();
      const userRequests = requests.get(key) || [];
      
      // Remove old requests
      const recentRequests = userRequests.filter(time => now - time < windowMs);
      
      if (recentRequests.length >= maxRequests) {
        return false; // Rate limited
      }
      
      recentRequests.push(now);
      requests.set(key, recentRequests);
      return true;
    };
  }
  
  // CSRF protection
  static generateCSRFToken(): string {
    return crypto.randomUUID();
  }
  
  static validateCSRFToken(token: string, expectedToken: string): boolean {
    return token === expectedToken;
  }
  
  // XSS protection
  static escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
  
  // SQL injection protection (for dynamic queries)
  static sanitizeSQLIdentifier(identifier: string): string {
    return identifier.replace(/[^a-zA-Z0-9_]/g, '');
  }
}
```

#### **8.4 Security Integration**
```typescript
// Priority: HIGH
// Estimated Time: 2 hours
// File: src/components/leaderboard/LeaderboardTable.tsx

// Update existing LeaderboardTable with security measures
export const LeaderboardTable: React.FC<{ teams: LeaderboardTeam[] }> = ({ teams }) => {
  const [csrfToken] = useState(() => SecurityManager.generateCSRFToken());
  const clientRateLimiter = useMemo(() => 
    SecurityManager.createClientRateLimiter(10, 60000), // 10 requests per minute
    []
  );
  
  const handleTeamClick = useCallback((teamId: string) => {
    // Check rate limiting
    if (!clientRateLimiter(`team_click_${teamId}`)) {
      toast.error('Too many requests. Please wait a moment.');
      return;
    }
    
    // Validate CSRF token
    if (!SecurityManager.validateCSRFToken(csrfToken, csrfToken)) {
      toast.error('Security validation failed. Please refresh the page.');
      return;
    }
    
    // Proceed with team selection
    navigate(`/team/${teamId}`);
  }, [csrfToken, clientRateLimiter]);
  
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Progress
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Runner
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Projected Finish
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {teams.map((team, index) => (
            <tr 
              key={team.id} 
              className="hover:bg-gray-50 cursor-pointer"
              onClick={() => handleTeamClick(team.id)}
            >
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {index + 1}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {SecurityManager.escapeHtml(team.name)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="w-32 bg-gray-200 rounded-full h-2 mr-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${team.progress_percentage}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-500">
                    {team.progress_percentage}%
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {SecurityManager.escapeHtml(team.current_runner_name || 'N/A')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatFinishTime(team.projected_finish_time)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

## ✨ **Phase 4: Polish & Monitoring (Week 4)**

### **Day 15-16: Accessibility, UX & Graceful Degradation**

#### **9.1 WCAG Compliance**
```typescript
// Priority: LOW
// Estimated Time: 6 hours
// Update LeaderboardTable.tsx

export const LeaderboardTable: React.FC<{ teams: LeaderboardTeam[] }> = ({ teams }) => {
  return (
    <div role="region" aria-label="Race Leaderboard">
      <table role="table" aria-label="Team Rankings">
        <thead>
          <tr>
            <th scope="col" id="rank">Rank</th>
            <th scope="col" id="team">Team</th>
            <th scope="col" id="progress">Progress</th>
            <th scope="col" id="finish">Projected Finish</th>
          </tr>
        </thead>
        <tbody>
          {teams.map((team, index) => (
            <tr key={team.id}>
              <td headers="rank">{index + 1}</td>
              <td headers="team">{team.name}</td>
              <td headers="progress">
                <div role="progressbar" 
                     aria-valuenow={team.progress_percentage}
                     aria-valuemin="0"
                     aria-valuemax="100">
                  {team.progress_percentage}% complete
                </div>
              </td>
              <td headers="finish">{formatFinishTime(team.projected_finish_time)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

#### **9.2 Graceful Degradation Implementation**
```typescript
// Priority: HIGH
// Estimated Time: 4 hours
// File: src/hooks/useOfflineLeaderboard.ts

export const useOfflineLeaderboard = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineData, setOfflineData] = useState<LeaderboardTeam[]>([]);
  const [lastOnlineSync, setLastOnlineSync] = useState<number | null>(null);
  
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Store last successful data for offline viewing
  const storeOfflineData = useCallback((data: LeaderboardTeam[]) => {
    try {
      localStorage.setItem('leaderboard_offline_data', JSON.stringify({
        data,
        timestamp: Date.now()
      }));
      setLastOnlineSync(Date.now());
    } catch (error) {
      console.warn('Failed to store offline data:', error);
    }
  }, []);
  
  // Load offline data when online
  const loadOfflineData = useCallback(() => {
    try {
      const stored = localStorage.getItem('leaderboard_offline_data');
      if (stored) {
        const { data, timestamp } = JSON.parse(stored);
        // Only use if less than 1 hour old
        if (Date.now() - timestamp < 60 * 60 * 1000) {
          setOfflineData(data);
          setLastOnlineSync(timestamp);
          return data;
        }
      }
    } catch (error) {
      console.warn('Failed to load offline data:', error);
    }
    return null;
  }, []);
  
  // Clean up old offline data
  const cleanupOfflineData = useCallback(() => {
    try {
      const stored = localStorage.getItem('leaderboard_offline_data');
      if (stored) {
        const { timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp > 24 * 60 * 60 * 1000) { // 24 hours
          localStorage.removeItem('leaderboard_offline_data');
        }
      }
    } catch (error) {
      console.warn('Failed to cleanup offline data:', error);
    }
  }, []);
  
  return { 
    isOnline, 
    offlineData, 
    lastOnlineSync,
    storeOfflineData, 
    loadOfflineData,
    cleanupOfflineData
  };
};
```

#### **9.3 Offline Leaderboard Component**
```typescript
// Priority: HIGH
// Estimated Time: 3 hours
// File: src/components/leaderboard/OfflineLeaderboard.tsx

export const OfflineLeaderboard: React.FC<{ teams: LeaderboardTeam[] }> = ({ teams }) => {
  const { isOnline, offlineData, lastOnlineSync, storeOfflineData, loadOfflineData } = useOfflineLeaderboard();
  
  // Store current data when online
  useEffect(() => {
    if (isOnline && teams.length > 0) {
      storeOfflineData(teams);
    }
  }, [isOnline, teams, storeOfflineData]);
  
  // Load offline data when going offline
  useEffect(() => {
    if (!isOnline) {
      loadOfflineData();
    }
  }, [isOnline, loadOfflineData]);
  
  const displayTeams = isOnline ? teams : offlineData;
  const isUsingOfflineData = !isOnline && offlineData.length > 0;
  
  if (isUsingOfflineData) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="text-sm font-medium text-yellow-800">
                You are offline
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Showing cached data from {lastOnlineSync ? new Date(lastOnlineSync).toLocaleTimeString() : 'unknown time'}
              </p>
            </div>
          </div>
        </div>
        
        <LeaderboardTable teams={displayTeams} />
      </div>
    );
  }
  
  if (!isOnline && offlineData.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <div>
            <h3 className="text-sm font-medium text-red-800">
              No offline data available
            </h3>
            <p className="text-sm text-red-700 mt-1">
              Please connect to the internet to view the leaderboard
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  return <LeaderboardTable teams={displayTeams} />;
};
```

### **Day 17-18: Performance Monitoring**

#### **10.1 Performance Metrics**
```typescript
// Priority: LOW
// Estimated Time: 4 hours
// File: src/utils/performanceMonitoring.ts

export class PerformanceMonitor {
  private metrics: Map<string, number[]> = new Map();
  
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(value);
  }
  
  getAverageMetric(name: string): number {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) return 0;
    
    return values.reduce((a, b) => a + b, 0) / values.length;
  }
  
  getMetricsReport(): PerformanceReport {
    return {
      averageResponseTime: this.getAverageMetric('response_time'),
      averageCacheHitRate: this.getAverageMetric('cache_hit_rate'),
      totalRequests: this.metrics.get('total_requests')?.length || 0,
      timestamp: new Date().toISOString()
    };
  }
}
```

### **Day 19-20: Final Testing & Documentation**

#### **11.1 Comprehensive Testing**
```typescript
// Priority: LOW
// Estimated Time: 8 hours
// File: src/tests/leaderboard.test.ts

describe('Leaderboard', () => {
  test('should calculate team projections correctly', () => {
    const mockTeam = createMockTeam();
    const projection = calculateTeamProjection(mockTeam);
    
    expect(projection).toBeDefined();
    expect(projection.progress_percentage).toBeGreaterThanOrEqual(0);
    expect(projection.progress_percentage).toBeLessThanOrEqual(100);
  });
  
  test('should handle missing data gracefully', () => {
    const incompleteTeam = { id: '1', name: 'Test Team' };
    const projection = calculateTeamProjection(incompleteTeam);
    
    expect(projection).toBeNull();
  });
  
  test('should update in real-time', async () => {
    // Test real-time subscription
    const { subscription } = renderHook(() => useLeaderboardRealtime());
    
    expect(subscription).toBeDefined();
  });
});
```

---

## 📊 **Success Metrics & KPIs**

### **Performance Targets**
- **Response Time**: <200ms average
- **Cache Hit Rate**: >90%
- **Error Rate**: <0.1%
- **Real-time Latency**: <1 second

### **User Experience Targets**
- **Page Load Time**: <2 seconds
- **Time to Interactive**: <3 seconds
- **Accessibility Score**: 100% WCAG 2.1 AA
- **Mobile Performance**: 90+ Lighthouse score

### **Scalability Targets**
- **Concurrent Users**: 10,000+
- **Teams Supported**: 1,000+
- **Database Load**: <50% CPU
- **Memory Usage**: <1GB

---

## 🚨 **Risk Mitigation**

### **Technical Risks**
1. **Database Performance**: Implement caching and query optimization
2. **Real-time Failures**: Fallback to polling
3. **Memory Leaks**: Proper cleanup in useEffect hooks
4. **Race Conditions**: Use proper state management

### **Business Risks**
1. **User Adoption**: Focus on core functionality first
2. **Performance Issues**: Implement monitoring and alerting
3. **Security Vulnerabilities**: RLS and rate limiting
4. **Scalability Limits**: Design for horizontal scaling

---

## 📅 **Timeline Summary**

| Week | Focus | Deliverables | Risk Level |
|------|-------|--------------|------------|
| 1 | Core Foundation | Basic leaderboard with projections | Low |
| 2 | Performance & Real-time | Caching, real-time updates | Medium |
| 3 | Optimization | Advanced caching, error handling | Medium |
| 4 | Polish & Monitoring | Accessibility, monitoring | Low |

---

## 🎯 **Next Steps**

1. **Start with Phase 1**: Build core functionality first
2. **Test incrementally**: Each phase should be testable
3. **Monitor performance**: Implement metrics early
4. **Gather feedback**: User testing after Phase 1
5. **Iterate based on data**: Adjust based on performance metrics

This implementation plan prioritizes core functionality while building a solid foundation for optimization and scalability.

---

## 🔍 **Critical Considerations & Solutions**

### **Database Schema Concerns**

#### **1. Cache Invalidation Strategy**
```typescript
// Priority: CRITICAL
// File: src/services/leaderboardCache.ts

export class LeaderboardCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number; version: string }>();
  
  // Add data version tracking
  async set(key: string, data: any, ttl: number, dataVersion?: string): Promise<void> {
    const version = dataVersion || this.generateDataVersion(data);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      version
    });
  }
  
  // Check if cached data is still valid
  async isStale(key: string, currentVersion: string): Promise<boolean> {
    const item = this.cache.get(key);
    if (!item) return true;
    
    return item.version !== currentVersion;
  }
  
  // Force recalculation when data changes
  async invalidateOnDataChange(teamId: string, changeType: 'leg' | 'runner' | 'team'): Promise<void> {
    // Invalidate all related cache entries
    const keysToDelete = Array.from(this.cache.keys()).filter(key => 
      key.includes(teamId) || key === 'full_leaderboard'
    );
    keysToDelete.forEach(key => this.cache.delete(key));
    
    // Log invalidation for debugging
    console.log(`Cache invalidated for team ${teamId} due to ${changeType} change`);
  }
}
```

#### **2. Audit/History Table**
```sql
-- Priority: HIGH
-- Estimated Time: 2 hours

-- Create leaderboard history table for debugging and analytics
CREATE TABLE IF NOT EXISTS leaderboard_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  teams_count INTEGER,
  calculation_time_ms INTEGER,
  cache_hit_rate DECIMAL(5,2),
  top_3_teams JSONB, -- Store top 3 for quick reference
  metadata JSONB, -- Additional debugging info
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for efficient querying
CREATE INDEX idx_leaderboard_history_snapshot_time ON leaderboard_history(snapshot_time);
CREATE INDEX idx_leaderboard_history_teams_count ON leaderboard_history(teams_count);

-- Function to capture leaderboard snapshots
CREATE OR REPLACE FUNCTION capture_leaderboard_snapshot(
  teams_count INTEGER,
  calculation_time_ms INTEGER,
  cache_hit_rate DECIMAL,
  top_3_teams JSONB,
  metadata JSONB DEFAULT '{}'::jsonb
) RETURNS UUID AS $$
DECLARE
  snapshot_id UUID;
BEGIN
  INSERT INTO leaderboard_history (
    teams_count,
    calculation_time_ms,
    cache_hit_rate,
    top_3_teams,
    metadata
  ) VALUES (
    teams_count,
    calculation_time_ms,
    cache_hit_rate,
    top_3_teams,
    metadata
  ) RETURNING id INTO snapshot_id;
  
  RETURN snapshot_id;
END;
$$ LANGUAGE plpgsql;
```

### **Edge Functions Improvements**

#### **3. Enhanced Rate Limiting**
```typescript
// Priority: HIGH
// File: supabase/functions/leaderboard-data/rateLimiter.ts

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
}

export class AdvancedRateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  constructor(private config: RateLimitConfig) {}
  
  async checkLimit(req: Request): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const key = this.config.keyGenerator(req);
    const now = Date.now();
    
    // Clean up expired entries
    this.cleanup();
    
    const entry = this.store.get(key);
    
    if (!entry || now > entry.resetTime) {
      // First request or window expired
      this.store.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      
      return {
        allowed: true,
        remaining: this.config.maxRequests - 1,
        resetTime: now + this.config.windowMs
      };
    }
    
    if (entry.count >= this.config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime
      };
    }
    
    // Increment count
    entry.count++;
    this.store.set(key, entry);
    
    return {
      allowed: true,
      remaining: this.config.maxRequests - entry.count,
      resetTime: entry.resetTime
    };
  }
  
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.resetTime) {
        this.store.delete(key);
      }
    }
  }
}

// Multiple rate limiting strategies
export const rateLimiters = {
  // IP-based (for basic protection)
  ipBased: new AdvancedRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    keyGenerator: (req) => req.headers.get('x-forwarded-for') || 'unknown'
  }),
  
  // User-based (if authenticated)
  userBased: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 100,
    keyGenerator: (req) => {
      const authHeader = req.headers.get('authorization');
      return authHeader ? `user_${authHeader}` : 'anonymous';
    }
  }),
  
  // Global rate limiting
  global: new AdvancedRateLimiter({
    windowMs: 60 * 1000,
    maxRequests: 1000,
    keyGenerator: () => 'global'
  })
};
```

#### **4. Enhanced Edge Function**
```typescript
// Priority: HIGH
// File: supabase/functions/leaderboard-data/index.ts

serve(async (req) => {
  // CORS handling
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Apply multiple rate limiting strategies
    const clientIP = req.headers.get('x-forwarded-for') || 'unknown';
    const authHeader = req.headers.get('authorization');
    
    // Check global rate limit first
    const globalLimit = await rateLimiters.global.checkLimit(req);
    if (!globalLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Global rate limit exceeded' }),
        { status: 429, headers: corsHeaders }
      );
    }
    
    // Check IP-based limit
    const ipLimit = await rateLimiters.ipBased.checkLimit(req);
    if (!ipLimit.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded for this IP' }),
        { status: 429, headers: corsHeaders }
      );
    }
    
    // Check user-based limit if authenticated
    if (authHeader) {
      const userLimit = await rateLimiters.userBased.checkLimit(req);
      if (!userLimit.allowed) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded for this user' }),
          { status: 429, headers: corsHeaders }
        );
      }
    }

    const { last_update, force_refresh = false }: LeaderboardRequest = await req.json();
    
    const startTime = performance.now();
    
    // Get leaderboard data
    const result = await getLeaderboardData(last_update, force_refresh);
    
    const calculationTime = performance.now() - startTime;
    
    // Capture snapshot for debugging
    await captureLeaderboardSnapshot({
      teams_count: result.teams.length,
      calculation_time_ms: Math.round(calculationTime),
      cache_hit_rate: result.meta.cache_hit_rate || 0,
      top_3_teams: result.teams.slice(0, 3).map(t => ({ id: t.id, name: t.name, projected_finish: t.projected_finish_time })),
      metadata: {
        force_refresh,
        last_update,
        rate_limits: {
          global_remaining: globalLimit.remaining,
          ip_remaining: ipLimit.remaining,
          user_remaining: authHeader ? userLimit.remaining : 'N/A'
        }
      }
    });
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Leaderboard error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: corsHeaders }
    );
  }
});
```

### **Frontend Performance Improvements**

#### **5. Progressive Loading & Pagination**
```typescript
// Priority: HIGH
// File: src/hooks/useLeaderboardPagination.ts

interface PaginationConfig {
  pageSize: number;
  initialPage: number;
  enableVirtualization: boolean;
}

export const useLeaderboardPagination = (config: PaginationConfig) => {
  const [currentPage, setCurrentPage] = useState(config.initialPage);
  const [pageSize, setPageSize] = useState(config.pageSize);
  const [totalTeams, setTotalTeams] = useState(0);
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard', currentPage, pageSize],
    queryFn: () => fetchLeaderboardData({ page: currentPage, pageSize }),
    keepPreviousData: true, // Keep previous data while loading new page
    staleTime: 30000,
  });
  
  const totalPages = Math.ceil(totalTeams / pageSize);
  
  // Update total teams when data changes
  useEffect(() => {
    if (data?.meta?.total_teams) {
      setTotalTeams(data.meta.total_teams);
    }
  }, [data?.meta?.total_teams]);
  
  return {
    data: data?.teams || [],
    isLoading,
    error,
    currentPage,
    totalPages,
    pageSize,
    totalTeams,
    setCurrentPage,
    setPageSize,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
};
```

#### **6. Batched Real-time Updates**
```typescript
// Priority: HIGH
// File: src/hooks/useLeaderboardRealtime.ts

export const useLeaderboardRealtime = () => {
  const [subscription, setSubscription] = useState(null);
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set());
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const queryClient = useQueryClient();
  
  // Batch updates to prevent thrashing
  const batchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const BATCH_DELAY = 1000; // 1 second delay
  
  const processBatchedUpdates = useCallback(() => {
    if (pendingUpdates.size > 0) {
      const teamIds = Array.from(pendingUpdates);
      
      // Invalidate cache for all changed teams
      teamIds.forEach(teamId => {
        leaderboardCache.invalidateTeam(teamId);
      });
      
      // Trigger single query invalidation
      queryClient.invalidateQueries(['leaderboard']);
      
      // Clear pending updates
      setPendingUpdates(new Set());
      
      console.log(`Processed ${teamIds.length} batched updates`);
    }
  }, [pendingUpdates, queryClient]);
  
  useEffect(() => {
    const channel = supabase.channel('leaderboard-global')
      .on('broadcast', { event: 'team_updated' }, (payload) => {
        const { team_id, change_type, timestamp } = payload.payload;
        
        // Add to pending updates
        setPendingUpdates(prev => new Set([...prev, team_id]));
        
        // Clear existing timeout
        if (batchTimeoutRef.current) {
          clearTimeout(batchTimeoutRef.current);
        }
        
        // Set new timeout for batching
        batchTimeoutRef.current = setTimeout(processBatchedUpdates, BATCH_DELAY);
        
        setLastUpdate(timestamp);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('Leaderboard real-time subscription active');
        } else if (status === 'CLOSED') {
          console.warn('Leaderboard real-time subscription closed');
        }
      });
    
    setSubscription(channel);
    
    return () => {
      if (batchTimeoutRef.current) {
        clearTimeout(batchTimeoutRef.current);
      }
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [processBatchedUpdates]);
  
  return { subscription, lastUpdate, pendingUpdatesCount: pendingUpdates.size };
};
```

#### **7. Adaptive Virtual Scrolling**
```typescript
// Priority: MEDIUM
// File: src/components/leaderboard/AdaptiveVirtualizedLeaderboard.tsx

export const AdaptiveVirtualizedLeaderboard: React.FC<{ teams: LeaderboardTeam[] }> = ({ teams }) => {
  const [useVirtualization, setUseVirtualization] = useState(false);
  const [itemSize, setItemSize] = useState(80);
  
  // Determine if virtualization is needed based on team count
  useEffect(() => {
    const shouldUseVirtualization = teams.length > 100;
    setUseVirtualization(shouldUseVirtualization);
    
    // Adjust item size based on screen size
    const handleResize = () => {
      const isMobile = window.innerWidth < 768;
      setItemSize(isMobile ? 60 : 80);
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => window.removeEventListener('resize', handleResize);
  }, [teams.length]);
  
  if (!useVirtualization) {
    // Render normal list for small datasets
    return (
      <div className="space-y-2">
        {teams.map((team, index) => (
          <TeamRow key={team.id} team={team} rank={index + 1} />
        ))}
      </div>
    );
  }
  
  // Use virtualization for large datasets
  const Row = ({ index, style }: { index: number; style: React.CSSProperties }) => (
    <div style={style}>
      <TeamRow team={teams[index]} rank={index + 1} />
    </div>
  );
  
  return (
    <List
      height={600}
      itemCount={teams.length}
      itemSize={itemSize}
      width="100%"
      overscanCount={5} // Render extra items for smooth scrolling
    >
      {Row}
    </List>
  );
};
```

### **Updated Implementation Timeline**

| Week | Focus | New Considerations |
|------|-------|-------------------|
| 1 | Core Foundation | Add cache invalidation strategy, audit table |
| 2 | Performance & Real-time | Enhanced rate limiting, batched updates |
| 3 | Optimization | Progressive loading, adaptive virtualization |
| 4 | Polish & Monitoring | Performance monitoring, debugging tools |

### **Additional Success Metrics**

- **Cache Accuracy**: >99% (no stale data)
- **Rate Limit Effectiveness**: <0.1% legitimate requests blocked
- **Real-time Update Batching**: <5 updates per batch on average
- **Virtual Scrolling Performance**: 60fps with 1000+ teams
- **Audit Trail Completeness**: 100% of leaderboard changes logged

These improvements address the scalability and reliability concerns while maintaining the core functionality and performance targets.
