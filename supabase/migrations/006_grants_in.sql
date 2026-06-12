-- 006: Grantseeking - applications SAIF Bio submits to outside funders

create table bio_grants_in (
  id uuid primary key default gen_random_uuid(),
  funder_contact_id uuid not null references bio_contacts (id),
  opportunity_name text not null,
  program text,
  amount_requested_cents bigint check (amount_requested_cents >= 0),
  amount_awarded_cents bigint check (amount_awarded_cents >= 0),
  status text not null default 'prospect' check (status in ('prospect', 'preparing', 'submitted', 'awarded', 'declined', 'withdrawn')),
  application_deadline date,
  submitted_date date,
  decision_date date,
  grant_period_start date,
  grant_period_end date,
  restriction text check (restriction in ('unrestricted', 'donor_restricted')),
  owner_id uuid references bio_team_members (id),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_grants_in
  for each row execute function bio_set_updated_at();

create index idx_bio_grants_in_status on bio_grants_in (status);
create index idx_bio_grants_in_deadline on bio_grants_in (application_deadline);

-- Reporting obligations owed to funders on awarded grants
create table bio_grants_in_deliverables (
  id uuid primary key default gen_random_uuid(),
  grant_in_id uuid not null references bio_grants_in (id) on delete cascade,
  title text not null,
  deliverable_type text not null check (deliverable_type in ('narrative_report', 'financial_report', 'invoice', 'other')),
  due_date date not null,
  submitted_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'submitted', 'overdue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_grants_in_deliverables
  for each row execute function bio_set_updated_at();

create index idx_bio_grants_in_deliverables_grant on bio_grants_in_deliverables (grant_in_id);
create index idx_bio_grants_in_deliverables_due on bio_grants_in_deliverables (due_date);

alter table bio_grants_in enable row level security;
alter table bio_grants_in_deliverables enable row level security;

create policy "Partners full access" on bio_grants_in
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_grants_in_deliverables
  for all using (bio_is_partner()) with check (bio_is_partner());
