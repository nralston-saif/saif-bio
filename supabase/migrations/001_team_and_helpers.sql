-- 001: Team members, RLS helper functions, auth linking
-- SAIF Bio is internal-only: three partners. Every table's RLS requires
-- bio_is_partner(). Signups are disabled in Supabase Auth settings; the
-- trigger below is belt-and-suspenders against any future signup path.

create extension if not exists "pgcrypto";

-- Shared updated_at trigger function used by all tables
create or replace function bio_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table bio_team_members (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  email text not null unique,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_team_members
  for each row execute function bio_set_updated_at();

insert into bio_team_members (email, full_name) values
  ('nick@saif.vc', 'Nick'),
  ('mike@saif.vc', 'Mike'),
  ('geoff@saif.vc', 'Geoff');

-- RLS helpers (SECURITY DEFINER so they can read bio_team_members regardless
-- of the caller's policies; STABLE so the planner caches per-statement)
create or replace function bio_is_partner()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from bio_team_members
    where auth_user_id = auth.uid() and is_active
  );
$$;

create or replace function bio_member_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select id from bio_team_members
  where auth_user_id = auth.uid() and is_active;
$$;

-- Link new auth users to their bio_team_members row by email.
-- Reject any email not in the team table.
create or replace function bio_link_team_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member_id uuid;
begin
  update bio_team_members
  set auth_user_id = new.id
  where lower(email) = lower(new.email)
    and auth_user_id is null
  returning id into member_id;

  if member_id is null and not exists (
    select 1 from bio_team_members where auth_user_id = new.id
  ) then
    raise exception 'Email % is not authorized for SAIF Bio', new.email;
  end if;

  return new;
end;
$$;

create trigger bio_on_auth_user_created
  after insert on auth.users
  for each row execute function bio_link_team_member();

alter table bio_team_members enable row level security;

create policy "Partners can view team" on bio_team_members
  for select using (bio_is_partner());

create policy "Partners can update team" on bio_team_members
  for update using (bio_is_partner()) with check (bio_is_partner());
