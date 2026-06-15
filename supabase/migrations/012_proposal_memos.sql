-- 012: Evaluation memos for grant proposals
--
-- One shared memo per proposal: top section is restated from the proposal
-- (grantee/amount/summary live on bio_grant_proposals), this table holds the
-- 15 free-text rubric prompts that the partners fill in collaboratively
-- before a decision is recorded. recordDecision is gated on all 15 being
-- non-empty.

create table bio_proposal_memos (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null unique references bio_grant_proposals (id) on delete cascade,

  -- Rubric prompts (free text, all required for decision-readiness)
  q_candidate_background text,
  q_values_alignment text,
  q_cause_area text,
  q_theory_of_change text,
  q_output_product text,
  q_amount_justification text,
  q_counterfactual text,
  q_success_outcomes text,
  q_disappointing_outcomes text,
  q_org_benefit text,
  q_me_plan text,
  q_risks text,
  q_legal_reputational_risks text,
  q_success_measurement text,
  q_open_questions text,

  started_by uuid references bio_team_members (id),
  last_edited_by uuid references bio_team_members (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_updated_at before update on bio_proposal_memos
  for each row execute function bio_set_updated_at();

alter table bio_proposal_memos enable row level security;

create policy "Partners full access" on bio_proposal_memos
  for all using (bio_is_partner()) with check (bio_is_partner());
