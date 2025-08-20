-- Fix invite token format to use UUID instead of long hex format
-- Run this in your Supabase SQL Editor to fix the issue

-- First, let's see what the current generate_invite_token function returns
SELECT public.generate_invite_token() as current_token_format;

-- Check existing teams to see their current token format
SELECT 
  id, 
  name, 
  invite_token, 
  LENGTH(invite_token) as token_length,
  CASE 
    WHEN invite_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID Format'
    WHEN invite_token ~ '^[a-f0-9]{64}$' THEN 'Hex Format (64 chars)'
    ELSE 'Other Format'
  END as token_type
FROM public.teams 
ORDER BY created_at DESC
LIMIT 10;

-- Update the generate_invite_token function to use UUID format
CREATE OR REPLACE FUNCTION public.generate_invite_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT gen_random_uuid()::text;
$$;

-- Convert existing hex-format invite tokens to UUID format
-- This will update all teams that have the long hex format tokens (64 characters)
UPDATE public.teams 
SET invite_token = gen_random_uuid()::text
WHERE invite_token ~ '^[a-f0-9]{64}$';

-- Update the invite_token_rotated_at timestamp for all updated tokens
UPDATE public.teams 
SET invite_token_rotated_at = now()
WHERE invite_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Test the new function
SELECT public.generate_invite_token() as new_token_format;

-- Verify the fix by checking teams again
SELECT 
  id, 
  name, 
  invite_token, 
  LENGTH(invite_token) as token_length,
  CASE 
    WHEN invite_token ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 'UUID Format'
    WHEN invite_token ~ '^[a-f0-9]{64}$' THEN 'Hex Format (64 chars)'
    ELSE 'Other Format'
  END as token_type
FROM public.teams 
ORDER BY created_at DESC
LIMIT 10;
