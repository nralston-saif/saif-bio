-- 015: QuickBooks Online integration — connection, entity mappings, expense sync state

-- Single-row table (like bio_settings) holding the OAuth connection to the
-- QuickBooks company. Tokens rotate: access ~1h, refresh ~100 days.
create table bio_qbo_connection (
  id integer primary key default 1 check (id = 1),
  environment text not null check (environment in ('sandbox', 'production')),
  realm_id text not null,
  company_name text,
  access_token text not null,
  refresh_token text not null,
  access_token_expires_at timestamptz not null,
  refresh_token_expires_at timestamptz not null,
  connected_by uuid references bio_team_members (id),
  connected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_qbo_connection
  for each row execute function bio_set_updated_at();

-- Maps our local dimensions onto QuickBooks entities:
--   category         local_key = bio_expense_categories.id → QBO expense Account
--   functional_class local_key = program|management_general|fundraising → QBO Class
--   payment_method   local_key = card|check|ach|wire|reimbursement → QBO Bank/CC Account
create table bio_qbo_mappings (
  id uuid primary key default gen_random_uuid(),
  mapping_type text not null check (mapping_type in ('category', 'functional_class', 'payment_method')),
  local_key text not null,
  qbo_id text not null,
  qbo_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (mapping_type, local_key)
);

create trigger set_updated_at before update on bio_qbo_mappings
  for each row execute function bio_set_updated_at();

alter table bio_expenses
  add column qbo_purchase_id text,
  add column qbo_sync_status text not null default 'not_synced'
    check (qbo_sync_status in ('not_synced', 'synced', 'failed')),
  add column qbo_synced_at timestamptz,
  add column qbo_sync_error text;

-- QBO Vendor id once a contact has been pushed as a vendor
alter table bio_contacts
  add column qbo_vendor_id text;

alter table bio_qbo_connection enable row level security;
alter table bio_qbo_mappings enable row level security;

create policy "Partners full access" on bio_qbo_connection
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_qbo_mappings
  for all using (bio_is_partner()) with check (bio_is_partner());
