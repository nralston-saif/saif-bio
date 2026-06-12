-- 004: Expense categories (990 functional classes) and expenses

create table bio_expense_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  functional_class text not null check (functional_class in ('program', 'management_general', 'fundraising')),
  form_990_line text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_expense_categories
  for each row execute function bio_set_updated_at();

insert into bio_expense_categories (name, functional_class, form_990_line) values
  ('Grants paid', 'program', 'Part IX line 1'),
  ('Program supplies & services', 'program', 'Part IX line 24'),
  ('Legal fees', 'management_general', 'Part IX line 11b'),
  ('Accounting fees', 'management_general', 'Part IX line 11c'),
  ('Professional fees - other', 'management_general', 'Part IX line 11g'),
  ('Insurance', 'management_general', 'Part IX line 23'),
  ('Software & IT', 'management_general', 'Part IX line 14'),
  ('Bank & payment fees', 'management_general', 'Part IX line 24'),
  ('Filing & registration fees', 'management_general', 'Part IX line 24'),
  ('Travel', 'program', 'Part IX line 17'),
  ('Conferences & meetings', 'program', 'Part IX line 19'),
  ('Office & postage', 'management_general', 'Part IX line 13'),
  ('Fundraising events', 'fundraising', 'Part IX line 24'),
  ('Fundraising - other', 'fundraising', 'Part IX line 24');

create table bio_expenses (
  id uuid primary key default gen_random_uuid(),
  expense_date date not null,
  amount_cents bigint not null check (amount_cents >= 0),
  description text not null,
  category_id uuid not null references bio_expense_categories (id),
  vendor_contact_id uuid references bio_contacts (id),
  payment_method text check (payment_method in ('card', 'check', 'ach', 'wire', 'reimbursement')),
  status text not null default 'paid' check (status in ('pending', 'paid', 'reimbursed')),
  -- Set when a partner fronted the expense personally and needs reimbursement
  paid_by uuid references bio_team_members (id),
  is_1099_eligible boolean not null default false,
  -- Set when this expense was auto-created from a grant disbursement
  disbursement_id uuid,
  notes text,
  entered_by uuid references bio_team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_expenses
  for each row execute function bio_set_updated_at();

create index idx_bio_expenses_date on bio_expenses (expense_date);
create index idx_bio_expenses_category on bio_expenses (category_id);
create index idx_bio_expenses_vendor on bio_expenses (vendor_contact_id);

alter table bio_expense_categories enable row level security;
alter table bio_expenses enable row level security;

create policy "Partners full access" on bio_expense_categories
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_expenses
  for all using (bio_is_partner()) with check (bio_is_partner());
