-- Fix leaderboard entries with incorrect team start times
-- This script identifies and fixes leaderboard entries that are using the placeholder start time
-- instead of the actual race start time

-- First, let's see what we have in the leaderboard table
SELECT 
  team_id,
  team_name,
  team_start_time,
  TO_TIMESTAMP(team_start_time / 1000) as start_time_readable,
  current_leg,
  projected_finish_time,
  TO_TIMESTAMP(projected_finish_time / 1000) as projected_finish_readable,
  last_updated_at
FROM leaderboard
ORDER BY team_start_time;

-- Check for entries with placeholder start time (2099-12-31)
SELECT 
  team_id,
  team_name,
  team_start_time,
  TO_TIMESTAMP(team_start_time / 1000) as start_time_readable,
  current_leg,
  projected_finish_time,
  TO_TIMESTAMP(projected_finish_time / 1000) as projected_finish_readable,
  CASE 
    WHEN current_leg > 1 THEN 
      -- For teams that have started, estimate start time based on current leg and projected finish
      projected_finish_time - (current_leg - 1) * 30 * 60 * 1000
    ELSE 
      -- For teams that haven't started, use a reasonable default
      projected_finish_time - 36 * 30 * 60 * 1000
  END as estimated_start_time,
  TO_TIMESTAMP(
    CASE 
      WHEN current_leg > 1 THEN 
        projected_finish_time - (current_leg - 1) * 30 * 60 * 1000
      ELSE 
        projected_finish_time - 36 * 30 * 60 * 1000
    END / 1000
  ) as estimated_start_readable
FROM leaderboard
WHERE team_start_time > 4102444800000  -- Timestamp for 2099-12-31
ORDER BY team_start_time;

-- Update entries with placeholder start times to use estimated start times
-- Only run this if you're sure about the changes
/*
UPDATE leaderboard
SET team_start_time = CASE 
  WHEN current_leg > 1 THEN 
    -- For teams that have started, estimate start time based on current leg and projected finish
    projected_finish_time - (current_leg - 1) * 30 * 60 * 1000
  ELSE 
    -- For teams that haven't started, use a reasonable default
    projected_finish_time - 36 * 30 * 60 * 1000
  END,
  last_updated_at = NOW()
WHERE team_start_time > 4102444800000;  -- Timestamp for 2099-12-31
*/
