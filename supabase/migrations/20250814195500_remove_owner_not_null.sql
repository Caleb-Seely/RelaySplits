-- Make teams.owner_id nullable to support team/device auth without user login
ALTER TABLE public.teams
  ALTER COLUMN owner_id DROP NOT NULL;

-- Note:
-- RLS remains enabled as previously configured. Edge Functions using the service role
-- bypass RLS and will enforce authorization using team secrets and device roles.
-- If you want to prevent any direct anon-table access, ensure there are no permissive
-- policies for anon on teams and related tables.
