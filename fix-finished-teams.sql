-- Fix finished teams by updating their projected_finish_time to actual finish time
-- This script updates teams that have finished (current_leg = 37) but still have the 18-hour estimate

-- First, let's see what we have
SELECT 
  team_id,
  team_name,
  team_start_time,
  TO_TIMESTAMP(team_start_time / 1000) as start_time_readable,
  current_leg,
  projected_finish_time,
  TO_TIMESTAMP(projected_finish_time / 1000) as projected_finish_readable,
  (projected_finish_time - team_start_time) / (1000 * 60 * 60) as total_hours,
  last_updated_at
FROM leaderboard
WHERE current_leg = 37
ORDER BY team_start_time;

-- For finished teams, we need to set the projected_finish_time to the actual finish time
-- The actual finish time should be when leg 36 finished, which is typically 
-- the last_updated_at time when the team reached leg 37

-- Update finished teams to use their actual finish time
-- We'll use the last_updated_at time as the actual finish time since that's when they reached leg 37
UPDATE leaderboard
SET 
  projected_finish_time = EXTRACT(EPOCH FROM last_updated_at) * 1000,
  current_leg_projected_finish = EXTRACT(EPOCH FROM last_updated_at) * 1000,
  last_updated_at = NOW()
WHERE current_leg = 37 
  AND ABS((projected_finish_time - team_start_time) / (1000 * 60 * 60) - 18) < 0.1;

-- Verify the fix
SELECT 
  team_id,
  team_name,
  team_start_time,
  TO_TIMESTAMP(team_start_time / 1000) as start_time_readable,
  current_leg,
  projected_finish_time,
  TO_TIMESTAMP(projected_finish_time / 1000) as projected_finish_readable,
  (projected_finish_time - team_start_time) / (1000 * 60 * 60) as total_hours,
  last_updated_at
FROM leaderboard
WHERE current_leg = 37
ORDER BY team_start_time;
