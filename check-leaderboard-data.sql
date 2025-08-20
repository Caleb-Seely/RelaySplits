-- Check current leaderboard data for finished teams
-- This will help us understand why the total time is always showing 18:00.00

-- Check all leaderboard entries
SELECT 
  team_id,
  team_name,
  team_start_time,
  TO_TIMESTAMP(team_start_time / 1000) as start_time_readable,
  current_leg,
  projected_finish_time,
  TO_TIMESTAMP(projected_finish_time / 1000) as projected_finish_readable,
  (projected_finish_time - team_start_time) / (1000 * 60 * 60) as total_hours,
  (projected_finish_time - team_start_time) / (1000 * 60) as total_minutes,
  last_updated_at
FROM leaderboard
ORDER BY current_leg DESC, team_start_time;

-- Check specifically for finished teams (leg 37)
SELECT 
  team_id,
  team_name,
  team_start_time,
  TO_TIMESTAMP(team_start_time / 1000) as start_time_readable,
  current_leg,
  projected_finish_time,
  TO_TIMESTAMP(projected_finish_time / 1000) as projected_finish_readable,
  (projected_finish_time - team_start_time) / (1000 * 60 * 60) as total_hours,
  (projected_finish_time - team_start_time) / (1000 * 60) as total_minutes,
  last_updated_at
FROM leaderboard
WHERE current_leg = 37
ORDER BY team_start_time;

-- Check for teams with exactly 18 hours total time
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
WHERE ABS((projected_finish_time - team_start_time) / (1000 * 60 * 60) - 18) < 0.1
ORDER BY team_start_time;
