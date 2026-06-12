-- 005: Grantmaking - proposals, reviews, awards, disbursements, grantee reports

create table bio_grant_proposals (
  id uuid primary key default gen_random_uuid(),
  applicant_contact_id uuid not null references bio_contacts (id),
  title text not null,
  summary text,
  program_area text,
  amount_requested_cents bigint check (amount_requested_cents >= 0),
  received_date date,
  source text,
  status text not null default 'received' check (status in ('received', 'in_review', 'decided', 'withdrawn')),
  decision text check (decision in ('approved', 'declined')),
  decision_date date,
  decision_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint decided_requires_decision check (
    status <> 'decided' or decision is not null
  )
);

create trigger set_updated_at before update on bio_grant_proposals
  for each row execute function bio_set_updated_at();

create index idx_bio_grant_proposals_status on bio_grant_proposals (status);

-- One review row per partner per proposal (score + vote + comments).
-- recused supports conflict-of-interest recusal: a recused partner records
-- the recusal but no score or vote.
create table bio_proposal_reviews (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references bio_grant_proposals (id) on delete cascade,
  reviewer_id uuid not null references bio_team_members (id),
  score int check (score between 1 and 5),
  vote text check (vote in ('yes', 'no', 'maybe')),
  comments text,
  recused boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (proposal_id, reviewer_id),
  constraint recused_means_no_vote check (
    not recused or (score is null and vote is null)
  )
);

create trigger set_updated_at before update on bio_proposal_reviews
  for each row execute function bio_set_updated_at();

create index idx_bio_proposal_reviews_proposal on bio_proposal_reviews (proposal_id);

create table bio_proposal_comments (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null references bio_grant_proposals (id) on delete cascade,
  author_id uuid not null references bio_team_members (id),
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_proposal_comments
  for each row execute function bio_set_updated_at();

create index idx_bio_proposal_comments_proposal on bio_proposal_comments (proposal_id);

-- Awarded grants. proposal_id is nullable so a grant can be recorded even if
-- the proposal was never tracked in the system.
create table bio_grants_out (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid unique references bio_grant_proposals (id),
  grantee_contact_id uuid not null references bio_contacts (id),
  purpose text,
  amount_awarded_cents bigint not null check (amount_awarded_cents >= 0),
  award_date date,
  restriction text,
  agreement_signed_date date,
  status text not null default 'awarded' check (status in ('awarded', 'active', 'completed', 'terminated')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_grants_out
  for each row execute function bio_set_updated_at();

create index idx_bio_grants_out_grantee on bio_grants_out (grantee_contact_id);

create table bio_disbursements (
  id uuid primary key default gen_random_uuid(),
  grant_out_id uuid not null references bio_grants_out (id) on delete cascade,
  amount_cents bigint not null check (amount_cents >= 0),
  scheduled_date date,
  paid_date date,
  method text check (method in ('check', 'ach', 'wire')),
  status text not null default 'scheduled' check (status in ('scheduled', 'paid', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_disbursements
  for each row execute function bio_set_updated_at();

create index idx_bio_disbursements_grant on bio_disbursements (grant_out_id);

-- Now that bio_disbursements exists, link the auto-created expense rows
alter table bio_expenses
  add constraint bio_expenses_disbursement_fk
  foreign key (disbursement_id) references bio_disbursements (id) on delete set null;

create table bio_grantee_reports (
  id uuid primary key default gen_random_uuid(),
  grant_out_id uuid not null references bio_grants_out (id) on delete cascade,
  report_type text not null check (report_type in ('progress', 'final', 'financial')),
  due_date date not null,
  received_date date,
  status text not null default 'upcoming' check (status in ('upcoming', 'received', 'overdue', 'waived')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_grantee_reports
  for each row execute function bio_set_updated_at();

create index idx_bio_grantee_reports_grant on bio_grantee_reports (grant_out_id);
create index idx_bio_grantee_reports_due on bio_grantee_reports (due_date);

-- RLS
alter table bio_grant_proposals enable row level security;
alter table bio_proposal_reviews enable row level security;
alter table bio_proposal_comments enable row level security;
alter table bio_grants_out enable row level security;
alter table bio_disbursements enable row level security;
alter table bio_grantee_reports enable row level security;

create policy "Partners full access" on bio_grant_proposals
  for all using (bio_is_partner()) with check (bio_is_partner());

-- Reviews: all partners can read, but each partner writes only their own row
create policy "Partners can read reviews" on bio_proposal_reviews
  for select using (bio_is_partner());
create policy "Reviewers insert own review" on bio_proposal_reviews
  for insert with check (reviewer_id = bio_member_id());
create policy "Reviewers update own review" on bio_proposal_reviews
  for update using (reviewer_id = bio_member_id()) with check (reviewer_id = bio_member_id());
create policy "Reviewers delete own review" on bio_proposal_reviews
  for delete using (reviewer_id = bio_member_id());

-- Comments: all partners read, authors edit/delete their own
create policy "Partners can read comments" on bio_proposal_comments
  for select using (bio_is_partner());
create policy "Authors insert own comments" on bio_proposal_comments
  for insert with check (author_id = bio_member_id());
create policy "Authors update own comments" on bio_proposal_comments
  for update using (author_id = bio_member_id()) with check (author_id = bio_member_id());
create policy "Authors delete own comments" on bio_proposal_comments
  for delete using (author_id = bio_member_id());

create policy "Partners full access" on bio_grants_out
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_disbursements
  for all using (bio_is_partner()) with check (bio_is_partner());

create policy "Partners full access" on bio_grantee_reports
  for all using (bio_is_partner()) with check (bio_is_partner());
