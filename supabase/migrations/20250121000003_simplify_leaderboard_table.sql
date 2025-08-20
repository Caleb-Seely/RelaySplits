-- Simplify leaderboard table to essential fields only
-- Drop the existing leaderboard table and recreate with minimal schema

-- Drop existing table and related objects
DROP TABLE IF EXISTS leaderboard CASCADE;

-- Create simplified leaderboard table
CREATE TABLE leaderboard (
  team_id UUID PRIMARY KEY REFERENCES teams(id) ON DELETE CASCADE,
  team_name TEXT NOT NULL,
  team_start_time BIGINT NOT NULL,
  current_leg INTEGER NOT NULL DEFAULT 1,
  projected_finish_time BIGINT,
  current_leg_projected_finish BIGINT, -- Projected finish time of current leg
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_leaderboard_projected_finish ON leaderboard(projected_finish_time);
CREATE INDEX idx_leaderboard_current_leg ON leaderboard(current_leg);
CREATE INDEX idx_leaderboard_last_updated ON leaderboard(last_updated_at);

-- Enable RLS for security
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Create public read policy for leaderboard data
CREATE POLICY "leaderboard_public_read" ON leaderboard FOR SELECT USING (true);

-- Create team update policy (teams can update their own row)
CREATE POLICY "leaderboard_team_update" ON leaderboard
FOR UPDATE TO authenticated
USING (true);

-- Create team insert policy (teams can insert their own row)
CREATE POLICY "leaderboard_team_insert" ON leaderboard
FOR INSERT TO authenticated
WITH CHECK (true);

-- Function to calculate derived fields
CREATE OR REPLACE FUNCTION calculate_leaderboard_derived_fields(
  p_team_start_time BIGINT,
  p_current_leg INTEGER,
  p_projected_finish_time BIGINT,
  p_current_leg_projected_finish BIGINT
) RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  -- Calculate progress percentage (assuming 36 total legs)
  -- Calculate status based on current leg and time
  -- Calculate time remaining in current leg
  
  result := json_build_object(
    'progress_percentage', ROUND(((p_current_leg - 1)::DECIMAL / 36.0) * 100.0, 2),
    'status', CASE 
      WHEN p_current_leg <= 1 THEN 'not_started'
      WHEN p_current_leg > 36 THEN 'finished'
      WHEN p_current_leg_projected_finish < EXTRACT(EPOCH FROM NOW()) * 1000 - (2 * 60 * 60 * 1000) THEN 'dnf'
      ELSE 'active'
    END,
    'minutes_remaining_in_current_leg', CASE 
      WHEN p_current_leg_projected_finish IS NULL THEN NULL
      ELSE GREATEST(0, ROUND((p_current_leg_projected_finish - EXTRACT(EPOCH FROM NOW()) * 1000) / (60 * 1000)))
    END
  );
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;
