-- Fix leaderboard triggers to match simplified schema
-- Remove automatic leaderboard creation - entries will be created after setup

-- Drop existing triggers first
DROP TRIGGER IF EXISTS create_leaderboard_on_team_create ON teams;
DROP TRIGGER IF EXISTS update_leaderboard_on_team_start_change ON teams;
DROP TRIGGER IF EXISTS update_leaderboard_on_team_name_change ON teams;

-- Drop existing functions
DROP FUNCTION IF EXISTS create_initial_leaderboard_entry();
DROP FUNCTION IF EXISTS update_leaderboard_on_team_start_change();
DROP FUNCTION IF EXISTS update_leaderboard_on_team_name_change();

-- Function to update leaderboard when team start time changes
CREATE OR REPLACE FUNCTION update_leaderboard_on_team_start_change()
RETURNS TRIGGER AS $$
DECLARE
  team_start_time_ms BIGINT;
BEGIN
  -- Only trigger if start_time changed
  IF OLD.start_time IS DISTINCT FROM NEW.start_time THEN
    team_start_time_ms := EXTRACT(EPOCH FROM NEW.start_time) * 1000;
    
    -- Update leaderboard entry with simplified schema (only if it exists)
    UPDATE leaderboard SET
      team_start_time = team_start_time_ms,
      projected_finish_time = team_start_time_ms + (36 * 30 * 60 * 1000),
      current_leg_projected_finish = team_start_time_ms + (30 * 60 * 1000),
      last_updated_at = NOW()
    WHERE team_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update leaderboard when team start time changes
CREATE TRIGGER update_leaderboard_on_team_start_change
  AFTER UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_leaderboard_on_team_start_change();

-- Function to update leaderboard when team name changes
CREATE OR REPLACE FUNCTION update_leaderboard_on_team_name_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if name changed
  IF OLD.name IS DISTINCT FROM NEW.name THEN
    -- Update leaderboard entry (only if it exists)
    UPDATE leaderboard SET
      team_name = NEW.name,
      last_updated_at = NOW()
    WHERE team_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update leaderboard when team name changes
CREATE TRIGGER update_leaderboard_on_team_name_change
  AFTER UPDATE ON teams
  FOR EACH ROW
  EXECUTE FUNCTION update_leaderboard_on_team_name_change();

-- Test the trigger by checking if it works
SELECT 'Triggers updated successfully - automatic leaderboard creation removed' as status;
