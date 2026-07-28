-- 016: Contact tax status — drives 990 Schedule I grantee reporting (IRC
-- section column) and grant diligence (non-charity grantees need charitable-use
-- documentation). Null = not yet determined.
alter table bio_contacts
  add column tax_status text check (tax_status in (
    '501c3_public_charity',
    '501c3_private_foundation',
    'other_nonprofit',
    'government',
    'for_profit',
    'individual'
  ));
