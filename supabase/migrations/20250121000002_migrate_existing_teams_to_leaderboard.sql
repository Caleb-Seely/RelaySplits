-- Phase 3: Migrate existing teams to leaderboard table

-- Function to create leaderboard entries for existing teams that don't have them
CREATE OR REPLACE FUNCTION migrate_existing_teams_to_leaderboard()
RETURNS INTEGER AS $$
DECLARE
  team_record RECORD;
  migrated_count INTEGER := 0;
  team_start_time_ms BIGINT;
BEGIN
  -- Find teams that don't have leaderboard entries
  FOR team_record IN 
    SELECT t.id, t.name, t.start_time
    FROM teams t
    LEFT JOIN leaderboard l ON t.id = l.team_id
    WHERE l.team_id IS NULL
  LOOP
    -- Convert team start_time to milliseconds
    team_start_time_ms := EXTRACT(EPOCH FROM team_record.start_time) * 1000;
    
    -- Create leaderboard entry for existing team with simplified schema
    INSERT INTO leaderboard (
      team_id,
      team_name,
      team_start_time,
      current_leg,
      projected_finish_time,
      current_leg_projected_finish,
      last_updated_at
    ) VALUES (
      team_record.id,
      team_record.name,
      team_start_time_ms,
      1, -- Start at leg 1
      team_start_time_ms + (36 * 30 * 60 * 1000), -- 30 min per leg estimate
      team_start_time_ms + (30 * 60 * 1000), -- 30 min for first leg
      NOW()
    );
    
    migrated_count := migrated_count + 1;
  END LOOP;
  
  RETURN migrated_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the migration
SELECT migrate_existing_teams_to_leaderboard() as teams_migrated;

-- Clean up the migration function
DROP FUNCTION migrate_existing_teams_to_leaderboard();

-- Update any teams that have completed legs to reflect their actual progress
CREATE OR REPLACE FUNCTION update_leaderboard_for_completed_legs()
RETURNS INTEGER AS $$
DECLARE
  team_record RECORD;
  updated_count INTEGER := 0;
  completed_legs_count INTEGER;
  last_completed_leg_time BIGINT;
  current_leg_number INTEGER;
BEGIN
  -- Find teams with completed legs and update their leaderboard entries
  FOR team_record IN 
    SELECT DISTINCT t.id, t.name, t.start_time
    FROM teams t
    JOIN legs l ON t.id = l.team_id
    WHERE l.finish_time IS NOT NULL
  LOOP
    -- Count completed legs for this team
    SELECT COUNT(*), MAX(EXTRACT(EPOCH FROM l.finish_time) * 1000)
    INTO completed_legs_count, last_completed_leg_time
    FROM legs l
    WHERE l.team_id = team_record.id AND l.finish_time IS NOT NULL;
    
    -- Calculate current leg (next leg to run)
    current_leg_number := completed_legs_count + 1;
    
    -- Update leaderboard entry with simplified schema
    UPDATE leaderboard SET
      current_leg = current_leg_number,
      current_leg_projected_finish = last_completed_leg_time + (30 * 60 * 1000), -- 30 min estimate for current leg
      projected_finish_time = last_completed_leg_time + ((36 - completed_legs_count) * 30 * 60 * 1000), -- Estimate remaining legs
      last_updated_at = NOW()
    WHERE team_id = team_record.id;
    
    updated_count := updated_count + 1;
  END LOOP;
  
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- Execute the update for completed legs
SELECT update_leaderboard_for_completed_legs() as teams_updated;

-- Clean up the update function
DROP FUNCTION update_leaderboard_for_completed_legs();
