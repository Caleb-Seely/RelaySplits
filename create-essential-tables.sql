-- Create essential tables manually
-- Run this in the Supabase SQL Editor

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_token UUID UNIQUE,
    join_code TEXT UNIQUE,
    admin_secret TEXT,
    invite_token_rotated_at TIMESTAMP WITH TIME ZONE,
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create team_members table
CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

-- 4. Create team_devices table
CREATE TABLE IF NOT EXISTS public.team_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, device_id)
);

-- 5. Create team_audit table
CREATE TABLE IF NOT EXISTS public.team_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    device_id TEXT,
    action TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Create runners table
CREATE TABLE IF NOT EXISTS public.runners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pace_minutes_per_mile DECIMAL(4,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create legs table
CREATE TABLE IF NOT EXISTS public.legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    runner_id UUID REFERENCES public.runners(id) ON DELETE SET NULL,
    leg_number INTEGER NOT NULL,
    distance_miles DECIMAL(5,2),
    start_time TIMESTAMP WITH TIME ZONE,
    finish_time TIMESTAMP WITH TIME ZONE,
    actual_start BIGINT,
    actual_finish BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, leg_number)
);

-- 8. Create leaderboard table (simplified)
CREATE TABLE IF NOT EXISTS public.leaderboard (
    team_id UUID PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
    team_name TEXT NOT NULL,
    team_start_time BIGINT NOT NULL,
    current_leg INTEGER NOT NULL DEFAULT 1,
    projected_finish_time BIGINT,
    current_leg_projected_finish BIGINT,
    last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_invite_token ON public.teams(invite_token);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON public.teams(join_code);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_team_devices_team_id ON public.team_devices(team_id);
CREATE INDEX IF NOT EXISTS idx_team_devices_device_id ON public.team_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_runners_team_id ON public.runners(team_id);
CREATE INDEX IF NOT EXISTS idx_legs_team_id ON public.legs(team_id);
CREATE INDEX IF NOT EXISTS idx_legs_team_runner ON public.legs(team_id, runner_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_projected_finish ON public.leaderboard(projected_finish_time);
CREATE INDEX IF NOT EXISTS idx_leaderboard_current_leg ON public.leaderboard(current_leg);
CREATE INDEX IF NOT EXISTS idx_leaderboard_last_updated ON public.leaderboard(last_updated_at);

-- 10. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 11. Create basic RLS policies (permissive for now)
CREATE POLICY "profiles_public_read" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "teams_public_read" ON public.teams FOR SELECT USING (true);
CREATE POLICY "teams_authenticated_insert" ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "teams_authenticated_update" ON public.teams FOR UPDATE TO authenticated USING (true);
CREATE POLICY "team_members_public_read" ON public.team_members FOR SELECT USING (true);
CREATE POLICY "team_devices_public_read" ON public.team_devices FOR SELECT USING (true);
CREATE POLICY "team_devices_authenticated_insert" ON public.team_devices FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "team_audit_public_read" ON public.team_audit FOR SELECT USING (true);
CREATE POLICY "team_audit_authenticated_insert" ON public.team_audit FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "runners_public_read" ON public.runners FOR SELECT USING (true);
CREATE POLICY "runners_authenticated_insert" ON public.runners FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "runners_authenticated_update" ON public.runners FOR UPDATE TO authenticated USING (true);
CREATE POLICY "legs_public_read" ON public.legs FOR SELECT USING (true);
CREATE POLICY "legs_authenticated_insert" ON public.legs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "legs_authenticated_update" ON public.legs FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leaderboard_public_read" ON public.leaderboard FOR SELECT USING (true);
CREATE POLICY "leaderboard_authenticated_insert" ON public.leaderboard FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "leaderboard_authenticated_update" ON public.leaderboard FOR UPDATE TO authenticated USING (true);

-- 12. Create database functions
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS UUID AS $$
BEGIN
    RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT AS $$
BEGIN
    RETURN upper(substring(md5(random()::text) from 1 for 6));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_admin_secret()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Create trigger for new user profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 14. Verify tables were created
SELECT 
    'Essential tables created successfully' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('profiles', 'teams', 'team_members', 'team_devices', 'team_audit', 'runners', 'legs', 'leaderboard');
