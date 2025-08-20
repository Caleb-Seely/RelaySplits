-- Create minimal tables needed for teams-create Edge Function
-- Run this in the Supabase SQL Editor

-- 1. Create teams table (with the columns actually used)
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    invite_token TEXT UNIQUE,
    join_code TEXT UNIQUE,
    admin_secret TEXT,
    invite_token_rotated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create team_devices table
CREATE TABLE IF NOT EXISTS public.team_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    device_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    first_name TEXT,
    last_name TEXT,
    display_name TEXT,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, device_id)
);

-- 3. Create team_audit table
CREATE TABLE IF NOT EXISTS public.team_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    device_id TEXT,
    action TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create runners table (needed for setup and leaderboard calculations)
CREATE TABLE IF NOT EXISTS public.runners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    pace NUMERIC NOT NULL,
    van TEXT NOT NULL,
    leg_ids UUID[] DEFAULT '{}',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create legs table (needed for setup and leaderboard calculations)
CREATE TABLE IF NOT EXISTS public.legs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    number INTEGER NOT NULL,
    runner_id UUID REFERENCES public.runners(id),
    distance NUMERIC NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE,
    finish_time TIMESTAMP WITH TIME ZONE,
    actual_start BIGINT,
    actual_finish BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, number)
);

-- 6. Create leaderboard table (simplified)
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

-- 7. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_teams_invite_token ON public.teams(invite_token);
CREATE INDEX IF NOT EXISTS idx_teams_join_code ON public.teams(join_code);
CREATE INDEX IF NOT EXISTS idx_team_devices_team_id ON public.team_devices(team_id);
CREATE INDEX IF NOT EXISTS idx_team_devices_device_id ON public.team_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_team_id ON public.team_audit(team_id);
CREATE INDEX IF NOT EXISTS idx_runners_team_id ON public.runners(team_id);
CREATE INDEX IF NOT EXISTS idx_legs_team_id ON public.legs(team_id);
CREATE INDEX IF NOT EXISTS idx_legs_team_runner ON public.legs(team_id, runner_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_projected_finish ON public.leaderboard(projected_finish_time);

-- 8. Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- 9. Create permissive RLS policies (for Edge Functions to work)
CREATE POLICY "teams_service_role" ON public.teams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "team_devices_service_role" ON public.team_devices FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "team_audit_service_role" ON public.team_audit FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "runners_service_role" ON public.runners FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "legs_service_role" ON public.legs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "leaderboard_service_role" ON public.leaderboard FOR ALL USING (true) WITH CHECK (true);

-- 10. Create database functions (the ones actually used by teams-create)
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS TEXT AS $$
BEGIN
    RETURN UPPER(substring(encode(gen_random_bytes(4), 'hex'), 1, 6));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.generate_admin_secret()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(32), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. Verify tables were created
SELECT 
    'All tables created successfully' as status,
    COUNT(*) as table_count
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('teams', 'team_devices', 'team_audit', 'runners', 'legs', 'leaderboard');
