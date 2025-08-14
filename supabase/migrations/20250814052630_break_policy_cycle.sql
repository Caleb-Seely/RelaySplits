-- Break circular RLS dependency between teams and team_members
-- teams_select_secure references team_members; to avoid recursion we must ensure
-- team_members_select_secure does not reference teams.

BEGIN;

DROP POLICY IF EXISTS "team_members_select_secure" ON public.team_members;

-- Non-recursive policy: users can read only their own membership rows.
-- Team owners will also be able to read membership once they are inserted as
-- an owner row in team_members (which your app does right after team creation).
CREATE POLICY "team_members_select_secure" ON public.team_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
);

COMMIT;
