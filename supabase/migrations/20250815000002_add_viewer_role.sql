-- Add viewer role to team_devices table
-- This migration adds the 'viewer' role to support view-only access

BEGIN;

-- Drop existing constraint and add new one with viewer role
ALTER TABLE public.team_devices DROP CONSTRAINT IF EXISTS team_devices_role_check;
ALTER TABLE public.team_devices ADD CONSTRAINT team_devices_role_check 
  CHECK (role IN ('admin', 'member', 'viewer'));

-- Add comment to document the role types
COMMENT ON COLUMN public.team_devices.role IS 'Role types: admin (full access), member (edit access), viewer (read-only access)';

COMMIT;
