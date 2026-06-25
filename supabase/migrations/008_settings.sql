-- 008: Singleton org settings (letterhead data, fiscal year)

create table bio_settings (
  id int primary key check (id = 1),
  org_legal_name text not null default 'SAIFbio Inc.',
  ein text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  fiscal_year_start_month int not null default 1 check (fiscal_year_start_month between 1 and 12),
  letter_signatory_name text,
  letter_signatory_title text,
  letter_from_email text,
  letter_closing_text text not null default 'Thank you for your generous support of our mission.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_settings
  for each row execute function bio_set_updated_at();

insert into bio_settings (id) values (1);

alter table bio_settings enable row level security;

create policy "Partners full access" on bio_settings
  for all using (bio_is_partner()) with check (bio_is_partner());
