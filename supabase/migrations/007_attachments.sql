-- 007: Polymorphic attachments (receipts, proposal docs, agreements,
-- grantee reports, governance documents)

create table bio_attachments (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in (
    'expense', 'contribution', 'grant_proposal', 'grant_out', 'grant_in',
    'grantee_report', 'grant_in_deliverable', 'contact', 'governance'
  )),
  -- Not a FK: points into different tables depending on entity_type.
  -- For 'governance' docs entity_id is the settings row id (1 as uuid is not
  -- valid, so governance rows use a fixed zero uuid).
  entity_id uuid not null,
  storage_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references bio_team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_attachments
  for each row execute function bio_set_updated_at();

create index idx_bio_attachments_entity on bio_attachments (entity_type, entity_id);

alter table bio_attachments enable row level security;

create policy "Partners full access" on bio_attachments
  for all using (bio_is_partner()) with check (bio_is_partner());
