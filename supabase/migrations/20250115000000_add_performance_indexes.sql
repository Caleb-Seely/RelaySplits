-- Add performance indexes for legs table
-- These indexes will optimize common query patterns in the relay race application

-- Index for queries that filter legs by team_id and runner_id
-- Optimizes runner assignment lookups and bulk operations
CREATE INDEX IF NOT EXISTS idx_legs_team_runner ON public.legs(team_id, runner_id);

-- Index for queries that filter legs by team_id and order by number
-- Optimizes the most common query pattern: loading all legs for a team ordered by leg number
CREATE INDEX IF NOT EXISTS idx_legs_team_number ON public.legs(team_id, number);

-- Add comment explaining the purpose of these indexes
COMMENT ON INDEX idx_legs_team_runner IS 'Optimizes queries filtering legs by team and runner assignment';
COMMENT ON INDEX idx_legs_team_number IS 'Optimizes queries loading legs for a team ordered by leg number';
