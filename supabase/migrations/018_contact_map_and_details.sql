-- =====================================================
-- Migration 018: bio_contact_map + bio_contact_details (Phase 4 of unified CRM plan)
-- Additive only. bio_contacts stays live until the Phase 5 cutover.
--
-- bio_contact_map records where each bio contact lives in the shared CRM
-- identity tables (project dxllkeajdtbtvsjjoaxr). At Phase 5 cutover it
-- drives the one-time remap of contact_id FKs on contributions/grants/etc.
-- bio_contact_details keeps nonprofit compliance + mailing data on this
-- side of the boundary, keyed by the SHARED contact UUID.
-- =====================================================

create table bio_contact_map (
  bio_contact_id uuid primary key references bio_contacts (id),
  shared_id uuid not null,
  shared_kind text not null check (shared_kind in ('person', 'company')),
  merged boolean not null default false, -- true when shared_id is a pre-existing CRM record
  created_at timestamptz not null default now()
);

create table bio_contact_details (
  shared_id uuid primary key,
  shared_kind text not null check (shared_kind in ('person', 'company')),
  legal_name text,
  email text,
  phone text,
  address_line1 text, address_line2 text, city text, state text,
  postal_code text, country text not null default 'US',
  tax_id text,
  tax_status text,
  w9_on_file boolean not null default false,
  qbo_vendor_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table bio_contact_map enable row level security;
alter table bio_contact_details enable row level security;
create policy contact_map_partners on bio_contact_map for all
  using (bio_is_partner()) with check (bio_is_partner());
create policy contact_details_partners on bio_contact_details for all
  using (bio_is_partner()) with check (bio_is_partner());

-- The 7-row map (import ran in CRM migration 065 on 2026-07-28)
insert into bio_contact_map (bio_contact_id, shared_id, shared_kind, merged) values
  ('baf8a508-1bd0-4a63-87ae-ffd3cddd32a2', 'baf8a508-1bd0-4a63-87ae-ffd3cddd32a2', 'person',  false), -- Mike and Marci Sapers
  ('4f3d4fe3-2557-4171-b3e6-0b7d0d4fa8e0', 'b74ccabc-0f6a-45e0-ba45-cb51a31a8c5e', 'person',  true),  -- "ralphi" -> partner Geoff
  ('5f818209-059c-4e6c-afa8-b06d1d03b190', '5f818209-059c-4e6c-afa8-b06d1d03b190', 'company', false), -- Ralston Family Trust
  ('e2439c3c-4e61-4e47-afcc-1c88a6a2767e', 'e2439c3c-4e61-4e47-afcc-1c88a6a2767e', 'person',  false), -- Lou Salkind
  ('214bd161-8a18-4844-b8ff-fe816e7a330d', '214bd161-8a18-4844-b8ff-fe816e7a330d', 'company', false), -- Arnold & Porter
  ('8018f39b-a99a-4280-abfa-8e895a597ff8', '8018f39b-a99a-4280-abfa-8e895a597ff8', 'company', false), -- Ergo Impact
  ('c28e9c65-8d6a-4268-81cf-f79b9d90fc1e', '4a94501a-9094-44bd-a693-646cbc6b3b31', 'company', true)   -- Halcyon -> Halcyon Futures
on conflict (bio_contact_id) do nothing;

insert into bio_contact_details (shared_id, shared_kind, legal_name, email, phone,
  address_line1, address_line2, city, state, postal_code, country,
  tax_id, tax_status, w9_on_file, qbo_vendor_id, notes)
select m.shared_id, m.shared_kind, c.org_name, nullif(c.email, ''), c.phone,
  c.address_line1, c.address_line2, c.city, c.state, c.postal_code, c.country,
  c.tax_id, c.tax_status, c.w9_on_file, c.qbo_vendor_id, c.notes
from bio_contact_map m
join bio_contacts c on c.id = m.bio_contact_id
on conflict (shared_id) do nothing;

select 'contact map + details created' as status;
