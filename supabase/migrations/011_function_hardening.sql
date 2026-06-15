-- 011: Function hardening (addresses Supabase security advisors)
--
-- 1. Pin search_path on the shared updated_at trigger function. Every other
--    function in 001 already does this; bio_set_updated_at was the only one
--    left with a role-mutable search_path (advisor 0011).
-- 2. Revoke EXECUTE on the auth-linking trigger function. It is only ever
--    invoked by the AFTER INSERT trigger on auth.users (trigger execution does
--    not check the caller's EXECUTE privilege), so it never needs to be
--    callable via PostgREST RPC by anon/authenticated (advisors 0028/0029).
--
-- bio_is_partner() and bio_member_id() are intentionally left executable by
-- authenticated: every RLS policy calls them, so they MUST remain executable.
-- They only ever return the calling user's own partner status / id.

create or replace function bio_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function bio_link_team_member() from public, anon, authenticated;
