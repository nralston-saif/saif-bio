-- 014: Public donation inquiries (from the saifbio.org donate form)
-- Visitors fill out the "Tell us about your gift" form on the public marketing
-- site (saifbio-website). That site forwards each submission server-to-server
-- to /api/public/donation-inquiry with a shared secret; the route inserts here
-- via the service-role client (which bypasses RLS). Partners review and triage
-- inquiries from /inquiries. There is deliberately no public insert policy —
-- the only writer is the trusted ingestion endpoint.

create table bio_donation_inquiries (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  phone text,
  organization text,
  -- How the donor wants to give; mirrors the donate page "Ways to give".
  gift_method text not null default 'other'
    check (gift_method in ('check', 'wire_ach', 'daf', 'stock_crypto', 'other')),
  -- Donor-stated amount. amount_cents is populated only when the raw input
  -- parses to a clean non-negative dollar figure; amount_text always keeps
  -- exactly what they typed (ranges, "TBD", crypto units, etc.).
  amount_cents bigint check (amount_cents >= 0),
  amount_text text,
  message text,
  status text not null default 'new'
    check (status in ('new', 'contacted', 'archived')),
  source text not null default 'website',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_donation_inquiries
  for each row execute function bio_set_updated_at();

create index idx_bio_donation_inquiries_status on bio_donation_inquiries (status);
create index idx_bio_donation_inquiries_created on bio_donation_inquiries (created_at desc);

alter table bio_donation_inquiries enable row level security;

create policy "Partners full access" on bio_donation_inquiries
  for all using (bio_is_partner()) with check (bio_is_partner());
