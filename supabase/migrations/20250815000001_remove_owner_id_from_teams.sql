-- Remove owner_id column from teams table
-- This field was designed for user-based authentication, but we're using team-based auth
-- where teams are created by devices, not users

-- Drop the foreign key constraint first (if it exists)
ALTER TABLE public.teams DROP CONSTRAINT IF EXISTS teams_owner_id_fkey;

-- Remove the owner_id column
ALTER TABLE public.teams DROP COLUMN IF EXISTS owner_id;

-- Add a comment to clarify the team-based model
COMMENT ON TABLE public.teams IS 'Teams are managed by devices using team secrets (invite_token, join_code, admin_secret). No user authentication required.';
