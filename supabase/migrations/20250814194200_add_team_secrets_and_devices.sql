-- Phase 1: Add team secrets and device-based identity (non-breaking)
-- This migration adds the new columns and tables needed for team-based auth
-- without removing existing auth-dependent structures

-- Add secrets and tokens to teams table
ALTER TABLE public.teams 
ADD COLUMN IF NOT EXISTS invite_token text UNIQUE,
ADD COLUMN IF NOT EXISTS join_code text UNIQUE,
ADD COLUMN IF NOT EXISTS admin_secret text,
ADD COLUMN IF NOT EXISTS invite_token_rotated_at timestamptz DEFAULT now(),
ADD COLUMN IF NOT EXISTS join_code_expires_at timestamptz;

-- Create team_devices table for device-based identity
CREATE TABLE IF NOT EXISTS public.team_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  device_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'member')),
  first_name text,
  last_name text,
  display_name text,
  last_seen timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure one device per team
  UNIQUE(team_id, device_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_devices_team_id ON public.team_devices(team_id);
CREATE INDEX IF NOT EXISTS idx_team_devices_device_id ON public.team_devices(device_id);
CREATE INDEX IF NOT EXISTS idx_team_devices_role ON public.team_devices(team_id, role);

-- Ensure domain tables have team_id indexes (they should already exist)
CREATE INDEX IF NOT EXISTS idx_runners_team_id ON public.runners(team_id);
CREATE INDEX IF NOT EXISTS idx_legs_team_id ON public.legs(team_id);

-- Generate initial secrets for existing teams (backfill)
-- This ensures existing teams get the new required fields
UPDATE public.teams 
SET 
  invite_token = COALESCE(invite_token, encode(gen_random_bytes(32), 'hex')),
  admin_secret = COALESCE(admin_secret, encode(gen_random_bytes(32), 'hex')),
  join_code = COALESCE(join_code, UPPER(substring(encode(gen_random_bytes(4), 'hex'), 1, 6)))
WHERE invite_token IS NULL OR admin_secret IS NULL OR join_code IS NULL;

-- Make the new columns NOT NULL after backfill
ALTER TABLE public.teams 
ALTER COLUMN invite_token SET NOT NULL,
ALTER COLUMN admin_secret SET NOT NULL;

-- Add RLS policies for team_devices (initially permissive, will be locked down later)
ALTER TABLE public.team_devices ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policy for team_devices (will be replaced in Phase 3)
CREATE POLICY "temp_team_devices_all" ON public.team_devices
FOR ALL USING (true) WITH CHECK (true);

-- Add audit table for tracking team actions (optional but recommended)
CREATE TABLE IF NOT EXISTS public.team_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  device_id text,
  action text NOT NULL,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_team_audit_team_id ON public.team_audit(team_id);
CREATE INDEX IF NOT EXISTS idx_team_audit_created_at ON public.team_audit(created_at);

-- Enable RLS on audit table
ALTER TABLE public.team_audit ENABLE ROW LEVEL SECURITY;

-- Temporary permissive policy for audit table
CREATE POLICY "temp_team_audit_all" ON public.team_audit
FOR ALL USING (true) WITH CHECK (true);

-- Add helpful functions for token generation (used by Edge Functions)
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT encode(gen_random_bytes(32), 'hex');
$$;

CREATE OR REPLACE FUNCTION public.generate_join_code()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT UPPER(substring(encode(gen_random_bytes(4), 'hex'), 1, 6));
$$;

CREATE OR REPLACE FUNCTION public.generate_admin_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT encode(gen_random_bytes(32), 'hex');
$$;

-- Add updated_at trigger for team_devices
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_team_devices_updated_at ON public.team_devices;
CREATE TRIGGER update_team_devices_updated_at 
  BEFORE UPDATE ON public.team_devices 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
