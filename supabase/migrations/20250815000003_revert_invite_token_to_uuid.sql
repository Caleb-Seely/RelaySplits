-- Revert invite token generation back to UUID format for better user experience
-- This changes the format from 64-character hex to standard UUID format

-- Update the generate_invite_token function to use UUID format
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT gen_random_uuid()::text;
$$;

-- Convert existing hex-format invite tokens to UUID format
-- This will update all teams that have the long hex format tokens
UPDATE public.teams 
SET invite_token = gen_random_uuid()::text
WHERE invite_token ~ '^[a-f0-9]{64}$';

-- Update the invite_token_rotated_at timestamp for all updated tokens
UPDATE public.teams 
SET invite_token_rotated_at = now()
WHERE invite_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
