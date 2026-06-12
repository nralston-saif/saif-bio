-- 009: Private storage buckets for documents and generated letters

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('letters', 'letters', false)
on conflict (id) do nothing;

-- Partners only, both buckets, all operations
create policy "Partners read documents" on storage.objects
  for select using (bucket_id in ('documents', 'letters') and bio_is_partner());

create policy "Partners upload documents" on storage.objects
  for insert with check (bucket_id in ('documents', 'letters') and bio_is_partner());

create policy "Partners update documents" on storage.objects
  for update using (bucket_id in ('documents', 'letters') and bio_is_partner());

create policy "Partners delete documents" on storage.objects
  for delete using (bucket_id in ('documents', 'letters') and bio_is_partner());
