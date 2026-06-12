-- 003: Contributions and acknowledgement letters (IRS Pub 1771)

create table bio_contributions (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references bio_contacts (id),
  -- Null only for in-kind gifts: the org describes the property but never
  -- asserts a value (Pub 1771 - valuation is the donor's responsibility)
  amount_cents bigint check (amount_cents >= 0),
  received_date date not null,
  method text not null check (method in ('check', 'ach', 'wire', 'credit_card', 'stock', 'crypto', 'in_kind')),
  in_kind_description text,
  restriction text not null default 'unrestricted' check (restriction in ('unrestricted', 'donor_restricted')),
  restriction_purpose text,
  quid_pro_quo boolean not null default false,
  goods_services_description text,
  goods_services_value_cents bigint check (goods_services_value_cents >= 0),
  check_number text,
  notes text,
  entered_by uuid references bio_team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint in_kind_requires_description check (
    method <> 'in_kind' or in_kind_description is not null
  ),
  constraint cash_requires_amount check (
    method = 'in_kind' or amount_cents is not null
  ),
  constraint quid_pro_quo_requires_details check (
    not quid_pro_quo or (goods_services_description is not null and goods_services_value_cents is not null)
  )
);

create trigger set_updated_at before update on bio_contributions
  for each row execute function bio_set_updated_at();

create index idx_bio_contributions_contact on bio_contributions (contact_id);
create index idx_bio_contributions_date on bio_contributions (received_date);

create table bio_acknowledgement_letters (
  id uuid primary key default gen_random_uuid(),
  contribution_id uuid not null unique references bio_contributions (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'generated', 'sent')),
  pdf_storage_path text,
  -- Frozen snapshot of the data the letter was rendered from, so later edits
  -- to the contribution or settings don't silently change a sent letter
  body_snapshot jsonb,
  sent_to_email text,
  sent_at timestamptz,
  resend_message_id text,
  generated_by uuid references bio_team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_acknowledgement_letters
  for each row execute function bio_set_updated_at();

alter table bio_contributions enable row level security;
alter table bio_acknowledgement_letters enable row level security;

create policy "Partners full access" on bio_contributions
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_acknowledgement_letters
  for all using (bio_is_partner()) with check (bio_is_partner());
