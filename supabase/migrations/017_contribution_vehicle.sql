-- 017: Giving vehicle — how the gift arrived (direct vs. an intermediary).
-- Compliance driver: DAF grants and IRA QCDs must not receive the standard
-- "your contribution is tax deductible" acknowledgement, and the donor may not
-- receive goods or services in exchange (IRC 4967 for DAFs; a QCD is fully
-- disqualified by any return benefit under IRC 408(d)(8)).

alter table bio_contributions
  add column vehicle text not null default 'direct' check (vehicle in (
    'direct',
    'daf',
    'private_foundation',
    'ira_qcd',
    'employer_match',
    'charitable_trust',
    'other'
  )),
  -- Intermediary organization: DAF sponsor (e.g. Fidelity Charitable),
  -- foundation, matching employer, IRA custodian, or trust name
  add column vehicle_sponsor_name text;

alter table bio_contributions
  add constraint vehicle_no_quid_pro_quo check (
    not quid_pro_quo or vehicle not in ('daf', 'ira_qcd')
  );
