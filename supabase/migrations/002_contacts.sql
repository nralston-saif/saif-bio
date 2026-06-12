-- 002: Contacts directory (donors, grantees, funders, vendors)

create table bio_contacts (
  id uuid primary key default gen_random_uuid(),
  contact_type text not null check (contact_type in ('individual', 'organization')),
  display_name text not null,
  org_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  country text not null default 'US',
  tax_id text, -- EIN for organizations; needed for 990 Schedule I
  is_donor boolean not null default false,
  is_grantee boolean not null default false,
  is_funder boolean not null default false,
  is_vendor boolean not null default false,
  w9_on_file boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_contacts
  for each row execute function bio_set_updated_at();

create index idx_bio_contacts_display_name on bio_contacts (display_name);

alter table bio_contacts enable row level security;

create policy "Partners full access" on bio_contacts
  for all using (bio_is_partner()) with check (bio_is_partner());
