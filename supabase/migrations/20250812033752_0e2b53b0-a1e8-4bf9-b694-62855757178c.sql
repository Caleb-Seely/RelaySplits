
-- Phase 1: Critical Database Security Fixes

-- 1. Remove the dangerous "Enable all operations for all users" policies
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.legs;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.runners;
DROP POLICY IF EXISTS "Enable all operations for all users" ON public.team_members;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.teams;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.teams;
DROP POLICY IF EXISTS "Enable update for all users" ON public.teams;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.teams;

-- 2. Remove the dangerous "Anyone can read teams" and "Anyone can read team members" policies
DROP POLICY IF EXISTS "Anyone can read teams" ON public.teams;
DROP POLICY IF EXISTS "Anyone can read team members" ON public.team_members;

-- 3. Remove duplicate/conflicting policies to clean up
DROP POLICY IF EXISTS "Members can view legs" ON public.legs;
DROP POLICY IF EXISTS "Members can update legs if free or paid" ON public.legs;
DROP POLICY IF EXISTS "Members can insert legs if free or paid" ON public.legs;
DROP POLICY IF EXISTS "Members can view runners" ON public.runners;
DROP POLICY IF EXISTS "Members can update runners if free or paid" ON public.runners;
DROP POLICY IF EXISTS "Members can insert runners if free or paid" ON public.runners;
DROP POLICY IF EXISTS "Members can view their membership" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view all members" ON public.team_members;
DROP POLICY IF EXISTS "Allow users to manage their own membership" ON public.team_members;
DROP POLICY IF EXISTS "Users can join teams" ON public.team_members;
DROP POLICY IF EXISTS "Users can manage their own membership" ON public.team_members;
DROP POLICY IF EXISTS "Users can leave teams" ON public.team_members;
DROP POLICY IF EXISTS "Team members can view team" ON public.teams;
DROP POLICY IF EXISTS "Team members can update team" ON public.teams;
DROP POLICY IF EXISTS "Allow authenticated users to create teams" ON public.teams;
DROP POLICY IF EXISTS "Users can create teams" ON public.teams;
DROP POLICY IF EXISTS "Team owners can update their teams" ON public.teams;

-- 4. Fix the check_team_exists function security
DROP FUNCTION IF EXISTS public.check_team_exists(uuid);
CREATE OR REPLACE FUNCTION public.check_team_exists(team_uuid uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM teams WHERE id = team_uuid
  );
END;
$function$;

-- 5. Create a security definer function to get user's subscription status
CREATE OR REPLACE FUNCTION public.get_user_subscription_status(user_uuid uuid)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
BEGIN
  RETURN (
    SELECT 
      CASE 
        WHEN subscription_status = 'active' THEN 'active'
        WHEN signup_time > (now() - interval '8 hours') THEN 'free_trial'
        ELSE 'expired'
      END
    FROM profiles 
    WHERE id = user_uuid
  );
END;
$function$;

-- 6. Create function to check if user can edit (has active subscription or within free trial)
CREATE OR REPLACE FUNCTION public.user_can_edit()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  status TEXT;
BEGIN
  status := public.get_user_subscription_status(auth.uid());
  RETURN status IN ('active', 'free_trial');
END;
$function$;

-- 7. Create simplified, secure RLS policies

-- Teams policies
CREATE POLICY "teams_select_secure" ON public.teams
FOR SELECT TO authenticated
USING (
  owner_id = auth.uid() OR 
  id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "teams_insert_secure" ON public.teams
FOR INSERT TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "teams_update_secure" ON public.teams
FOR UPDATE TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "teams_delete_secure" ON public.teams
FOR DELETE TO authenticated
USING (owner_id = auth.uid());

-- Team members policies
CREATE POLICY "team_members_select_secure" ON public.team_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid() OR
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "team_members_insert_secure" ON public.team_members
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid() OR
  team_id IN (
    SELECT id FROM teams WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "team_members_update_secure" ON public.team_members
FOR UPDATE TO authenticated
USING (
  user_id = auth.uid() OR
  team_id IN (
    SELECT id FROM teams WHERE owner_id = auth.uid()
  )
)
WITH CHECK (
  user_id = auth.uid() OR
  team_id IN (
    SELECT id FROM teams WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "team_members_delete_secure" ON public.team_members
FOR DELETE TO authenticated
USING (
  user_id = auth.uid() OR
  team_id IN (
    SELECT id FROM teams WHERE owner_id = auth.uid()
  )
);

-- Runners policies
CREATE POLICY "runners_select_secure" ON public.runners
FOR SELECT TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "runners_insert_secure" ON public.runners
FOR INSERT TO authenticated
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
);

CREATE POLICY "runners_update_secure" ON public.runners
FOR UPDATE TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
)
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
);

CREATE POLICY "runners_delete_secure" ON public.runners
FOR DELETE TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
);

-- Legs policies
CREATE POLICY "legs_select_secure" ON public.legs
FOR SELECT TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "legs_insert_secure" ON public.legs
FOR INSERT TO authenticated
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
);

CREATE POLICY "legs_update_secure" ON public.legs
FOR UPDATE TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
)
WITH CHECK (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
);

CREATE POLICY "legs_delete_secure" ON public.legs
FOR DELETE TO authenticated
USING (
  team_id IN (
    SELECT team_id FROM team_members WHERE user_id = auth.uid()
  ) AND
  public.user_can_edit()
);

-- 8. Ensure profiles are created when users sign up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, signup_time, subscription_status)
  VALUES (NEW.id, now(), 'free')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Add constraints to ensure data integrity
ALTER TABLE public.teams 
  ALTER COLUMN owner_id SET NOT NULL;

ALTER TABLE public.team_members 
  ALTER COLUMN user_id SET NOT NULL,
  ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE public.runners 
  ALTER COLUMN team_id SET NOT NULL;

ALTER TABLE public.legs 
  ALTER COLUMN team_id SET NOT NULL;

-- 10. Add indexes for better performance on security queries
CREATE INDEX IF NOT EXISTS idx_team_members_user_team ON public.team_members(user_id, team_id);
CREATE INDEX IF NOT EXISTS idx_teams_owner ON public.teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_runners_team ON public.runners(team_id);
CREATE INDEX IF NOT EXISTS idx_legs_team ON public.legs(team_id);
CREATE INDEX IF NOT EXISTS idx_profiles_signup_subscription ON public.profiles(signup_time, subscription_status);
