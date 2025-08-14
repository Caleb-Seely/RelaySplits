-- Phase 3: RLS Lockdown for Edge Functions model

-- 1) Enable RLS on target tables
alter table public.teams enable row level security;
alter table public.team_devices enable row level security;
alter table public.team_audit enable row level security;
alter table public.runners enable row level security;
alter table public.legs enable row level security;

-- 2) Drop existing policies on these tables (names unknown -> dynamic)
do $$
declare
  pol record;
begin
  for pol in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('teams','team_devices','team_audit','runners','legs')
  loop
    execute format('drop policy if exists %I on %I.%I', pol.policyname, pol.schemaname, pol.tablename);
  end loop;
end $$;

-- 3) Optional hardening: revoke default grants to anon/auth (keep PostgREST out)
-- Note: Service role bypasses RLS, these revokes are extra defense-in-depth.
revoke all on table public.teams from anon, authenticated;
revoke all on table public.team_devices from anon, authenticated;
revoke all on table public.team_audit from anon, authenticated;
revoke all on table public.runners from anon, authenticated;
revoke all on table public.legs from anon, authenticated;
