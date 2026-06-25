-- 014: Proposal field changes
--
-- Drops program_area (free-text category) in favor of a structured pillars
-- list (Detect / Prevent / Defend, any combination). Also adds entered_date,
-- a required date stamped at row creation by the server action using the
-- America/Los_Angeles calendar day. recordDecision and review flows are
-- unaffected.

alter table bio_grant_proposals
  drop column program_area,
  add column pillars text[] not null default '{}'
    check (pillars <@ array['detect','prevent','defend']),
  add column entered_date date not null default current_date;
