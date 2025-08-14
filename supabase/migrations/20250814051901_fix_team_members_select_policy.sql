-- Fix recursive RLS on team_members SELECT
-- This replaces a self-referencing policy that queried team_members within
-- its own USING clause, which triggers infinite recursion under RLS.

BEGIN;

-- Drop the problematic policy if it exists
DROP POLICY IF EXISTS "team_members_select_secure" ON public.team_members;

-- Recreate a non-recursive SELECT policy:
-- Allow users to read their own membership rows, and allow team owners to read
-- all memberships for teams they own. This avoids querying team_members from
-- within team_members policies.
CREATE POLICY "team_members_select_secure" ON public.team_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  team_id IN (
    SELECT id FROM public.teams WHERE owner_id = auth.uid()
  )
);

COMMIT;
