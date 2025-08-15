-- Make owner_id truly optional for team-based authentication model
-- This migration ensures that teams can be created without an owner_id

-- Update the teams table to make owner_id nullable and add a default value
ALTER TABLE public.teams 
  ALTER COLUMN owner_id DROP NOT NULL,
  ALTER COLUMN owner_id SET DEFAULT NULL;

-- Add a comment to clarify the new model
COMMENT ON COLUMN public.teams.owner_id IS 'Optional user ID for user-based teams. NULL for team-based authentication model.';

-- Add a function to help with team-based access control
CREATE OR REPLACE FUNCTION public.is_team_device(team_uuid UUID, device_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_devices 
    WHERE team_id = team_uuid AND device_id = is_team_device.device_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add a function to check if device is admin
CREATE OR REPLACE FUNCTION public.is_team_admin(team_uuid UUID, device_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.team_devices 
    WHERE team_id = team_uuid 
      AND device_id = is_team_admin.device_id 
      AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
