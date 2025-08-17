-- Test and fix invite token format
-- Run this in your Supabase SQL Editor to check current format and fix if needed

-- First, let's see what the current generate_invite_token function returns
SELECT public.generate_invite_token() as current_token_format;

-- Check a few existing teams to see their token format
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

-- If you see hex format tokens, run this to fix the function:
-- CREATE OR REPLACE FUNCTION public.generate_invite_token()
-- RETURNS text
-- LANGUAGE sql
-- SECURITY DEFINER
-- AS $$
--   SELECT gen_random_uuid()::text;
-- $$;

-- Then test the new function:
-- SELECT public.generate_invite_token() as new_token_format;

-- If you want to convert existing hex tokens to UUID format:
-- UPDATE public.teams 
-- SET invite_token = gen_random_uuid()::text
-- WHERE invite_token ~ '^[a-f0-9]{64}$';
