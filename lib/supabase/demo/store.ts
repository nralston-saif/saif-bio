/**
 * In-memory data store for demo mode (active when NEXT_PUBLIC_SUPABASE_URL
 * is not set). Lets the app run as a proof of concept with no database.
 * Data lives in module memory: writes work but reset on server restart /
 * new serverless instance.
 */

export const DEMO_AUTH_USER_ID = '00000000-0000-0000-0000-00000000d390'

type Row = Record<string, unknown>

interface DemoStore {
  tables: Record<string, Row[]>
  files: Map<string, { bytes: Uint8Array; contentType: string }>
}

// Stable ids so seeded relations hold together
const ids = {
  nick: '00000000-0000-0000-0000-000000000101',
  mike: '00000000-0000-0000-0000-000000000102',
  geoff: '00000000-0000-0000-0000-000000000103',
  donorJane: '00000000-0000-0000-0000-000000000201',
  donorAcmeFdn: '00000000-0000-0000-0000-000000000202',
  granteeLab: '00000000-0000-0000-0000-000000000203',
  granteeWatch: '00000000-0000-0000-0000-000000000204',
  funderOpen: '00000000-0000-0000-0000-000000000205',
  vendorAcct: '00000000-0000-0000-0000-000000000206',
  contribution1: '00000000-0000-0000-0000-000000000301',
  contribution2: '00000000-0000-0000-0000-000000000302',
  contribution3: '00000000-0000-0000-0000-000000000303',
  contribution4: '00000000-0000-0000-0000-000000000304',
  catGrants: '00000000-0000-0000-0000-000000000401',
  catAccounting: '00000000-0000-0000-0000-000000000402',
  catSoftware: '00000000-0000-0000-0000-000000000403',
  catTravel: '00000000-0000-0000-0000-000000000404',
  catLegal: '00000000-0000-0000-0000-000000000405',
  catInsurance: '00000000-0000-0000-0000-000000000406',
  catFundraising: '00000000-0000-0000-0000-000000000407',
  proposal1: '00000000-0000-0000-0000-000000000501',
  proposal2: '00000000-0000-0000-0000-000000000502',
  award1: '00000000-0000-0000-0000-000000000601',
  disb1: '00000000-0000-0000-0000-000000000701',
  disb2: '00000000-0000-0000-0000-000000000702',
  grantIn1: '00000000-0000-0000-0000-000000000801',
  inquiry1: '00000000-0000-0000-0000-000000000901',
  inquiry2: '00000000-0000-0000-0000-000000000902',
}

function ts(date: string): { created_at: string; updated_at: string } {
  return { created_at: `${date}T12:00:00Z`, updated_at: `${date}T12:00:00Z` }
}

function buildSeedTables(): Record<string, Row[]> {
  return {
    bio_team_members: [
      { id: ids.nick, auth_user_id: DEMO_AUTH_USER_ID, email: 'nick@saif.vc', full_name: 'Nick', is_active: true, ...ts('2026-01-05') },
      { id: ids.mike, auth_user_id: null, email: 'mike@saif.vc', full_name: 'Mike', is_active: true, ...ts('2026-01-05') },
      { id: ids.geoff, auth_user_id: null, email: 'geoff@saif.vc', full_name: 'Geoff', is_active: true, ...ts('2026-01-05') },
    ],
    bio_settings: [
      {
        id: 1,
        org_legal_name: 'SAIFbio Inc.',
        ein: '88-1234567',
        address_line1: '548 Market St',
        address_line2: 'PMB 61379',
        city: 'San Francisco',
        state: 'CA',
        postal_code: '94104',
        fiscal_year_start_month: 1,
        letter_signatory_name: 'Nick Ralston',
        letter_signatory_title: 'President',
        letter_from_email: 'letters@saifbio.org',
        letter_closing_text: 'Thank you for your generous support of our mission.',
        ...ts('2026-01-05'),
      },
    ],
    bio_contacts: [
      { id: ids.donorJane, contact_type: 'individual', display_name: 'Jane Donor', org_name: null, first_name: 'Jane', last_name: 'Donor', email: 'jane.donor@example.com', phone: '415-555-0101', address_line1: '1 Main St', address_line2: null, city: 'Oakland', state: 'CA', postal_code: '94601', country: 'US', tax_id: null, is_donor: true, is_grantee: false, is_funder: false, is_vendor: false, w9_on_file: false, notes: null, ...ts('2026-01-12') },
      { id: ids.donorAcmeFdn, contact_type: 'organization', display_name: 'Acme Family Foundation', org_name: 'Acme Family Foundation', first_name: null, last_name: null, email: 'grants@acmefamily.example.org', phone: null, address_line1: '200 Park Ave', address_line2: null, city: 'New York', state: 'NY', postal_code: '10166', country: 'US', tax_id: '13-7654321', is_donor: true, is_grantee: false, is_funder: true, is_vendor: false, w9_on_file: false, notes: 'Family foundation interested in biosecurity.', ...ts('2026-01-20') },
      { id: ids.granteeLab, contact_type: 'organization', display_name: 'BioSafety Lab Collective', org_name: 'BioSafety Lab Collective', first_name: null, last_name: null, email: 'grants@biosafetylab.example.org', phone: null, address_line1: '77 Research Way', address_line2: null, city: 'Boston', state: 'MA', postal_code: '02115', country: 'US', tax_id: '98-7654321', is_donor: false, is_grantee: true, is_funder: false, is_vendor: false, w9_on_file: false, notes: null, ...ts('2026-02-01') },
      { id: ids.granteeWatch, contact_type: 'organization', display_name: 'Pandemic Watch Institute', org_name: 'Pandemic Watch Institute', first_name: null, last_name: null, email: 'office@pandemicwatch.example.org', phone: null, address_line1: '9 Hill Rd', address_line2: null, city: 'Seattle', state: 'WA', postal_code: '98101', country: 'US', tax_id: '91-1122334', is_donor: false, is_grantee: true, is_funder: false, is_vendor: false, w9_on_file: false, notes: null, ...ts('2026-03-10') },
      { id: ids.funderOpen, contact_type: 'organization', display_name: 'Open Philanthropy Example Fund', org_name: 'Open Philanthropy Example Fund', first_name: null, last_name: null, email: 'programs@opef.example.org', phone: null, address_line1: null, address_line2: null, city: 'San Francisco', state: 'CA', postal_code: null, country: 'US', tax_id: null, is_donor: false, is_grantee: false, is_funder: true, is_vendor: false, w9_on_file: false, notes: null, ...ts('2026-02-15') },
      { id: ids.vendorAcct, contact_type: 'organization', display_name: 'Acme Accounting LLP', org_name: 'Acme Accounting LLP', first_name: null, last_name: null, email: 'billing@acmeacct.example.com', phone: null, address_line1: null, address_line2: null, city: 'San Francisco', state: 'CA', postal_code: null, country: 'US', tax_id: '11-2233445', is_donor: false, is_grantee: false, is_funder: false, is_vendor: true, w9_on_file: true, notes: null, ...ts('2026-01-15') },
    ],
    bio_contributions: [
      { id: ids.contribution1, contact_id: ids.donorJane, amount_cents: 250_000, received_date: '2026-03-15', method: 'wire', in_kind_description: null, restriction: 'unrestricted', restriction_purpose: null, quid_pro_quo: false, goods_services_description: null, goods_services_value_cents: null, check_number: null, notes: null, entered_by: ids.nick, ...ts('2026-03-15') },
      { id: ids.contribution2, contact_id: ids.donorJane, amount_cents: 50_000, received_date: '2026-05-01', method: 'check', in_kind_description: null, restriction: 'unrestricted', restriction_purpose: null, quid_pro_quo: true, goods_services_description: 'two fundraising dinner tickets', goods_services_value_cents: 15_000, check_number: '1042', notes: null, entered_by: ids.mike, ...ts('2026-05-01') },
      { id: ids.contribution3, contact_id: ids.donorAcmeFdn, amount_cents: 5_000_000, received_date: '2026-04-20', method: 'ach', in_kind_description: null, restriction: 'donor_restricted', restriction_purpose: 'Biosafety training programs', quid_pro_quo: false, goods_services_description: null, goods_services_value_cents: null, check_number: null, notes: null, entered_by: ids.nick, ...ts('2026-04-20') },
      { id: ids.contribution4, contact_id: ids.donorJane, amount_cents: 197_850, received_date: '2026-06-03', method: 'stock', in_kind_description: null, restriction: 'unrestricted', restriction_purpose: null, quid_pro_quo: false, goods_services_description: null, goods_services_value_cents: null, check_number: null, notes: 'Demo stock gift with internal FMV from broker statement.', entered_by: ids.nick, ...ts('2026-06-03') },
    ],
    bio_acknowledgement_letters: [],
    bio_security_prices: [
      { id: '00000000-0000-0000-0000-000000000d01', symbol: 'AAPL', price_date: '2026-06-03', open_cents: null, high_cents: null, low_cents: null, close_cents: 19_785, adjusted_close_cents: null, volume: 52_000_000, source: 'fmp', fetched_at: '2026-06-03T21:00:00Z', ...ts('2026-06-03') },
    ],
    bio_stock_contribution_details: [
      { contribution_id: ids.contribution4, security_name: 'Apple Inc. common stock', ticker_symbol: 'AAPL', cusip: '037833100', shares: 10, valuation_date: '2026-06-03', fmv_per_share_cents: 19_785, fmv_total_cents: 197_850, valuation_source: 'broker_statement', market_price_source: 'fmp', brokerage_account: 'Schwab demo brokerage', transfer_received_date: '2026-06-03', sale_date: null, sale_gross_cents: null, sale_fees_cents: null, sale_net_cents: null, notes: 'Broker statement attached in a real workflow.', ...ts('2026-06-03') },
    ],
    bio_expense_categories: [
      { id: ids.catGrants, name: 'Grants paid', functional_class: 'program', form_990_line: 'Part IX line 1', is_active: true, ...ts('2026-01-05') },
      { id: ids.catAccounting, name: 'Accounting fees', functional_class: 'management_general', form_990_line: 'Part IX line 11c', is_active: true, ...ts('2026-01-05') },
      { id: ids.catLegal, name: 'Legal fees', functional_class: 'management_general', form_990_line: 'Part IX line 11b', is_active: true, ...ts('2026-01-05') },
      { id: ids.catSoftware, name: 'Software & IT', functional_class: 'management_general', form_990_line: 'Part IX line 14', is_active: true, ...ts('2026-01-05') },
      { id: ids.catInsurance, name: 'Insurance', functional_class: 'management_general', form_990_line: 'Part IX line 23', is_active: true, ...ts('2026-01-05') },
      { id: ids.catTravel, name: 'Travel', functional_class: 'program', form_990_line: 'Part IX line 17', is_active: true, ...ts('2026-01-05') },
      { id: ids.catFundraising, name: 'Fundraising events', functional_class: 'fundraising', form_990_line: 'Part IX line 24', is_active: true, ...ts('2026-01-05') },
    ],
    bio_expenses: [
      { id: '00000000-0000-0000-0000-000000000901', expense_date: '2026-04-10', amount_cents: 120_000, description: 'Annual 990 preparation', category_id: ids.catAccounting, vendor_contact_id: ids.vendorAcct, payment_method: 'ach', status: 'paid', paid_by: null, is_1099_eligible: true, disbursement_id: null, notes: null, entered_by: ids.nick, ...ts('2026-04-10') },
      { id: '00000000-0000-0000-0000-000000000902', expense_date: '2026-05-22', amount_cents: 8_900, description: 'Google Workspace (May)', category_id: ids.catSoftware, vendor_contact_id: null, payment_method: 'card', status: 'paid', paid_by: null, is_1099_eligible: false, disbursement_id: null, notes: null, entered_by: ids.geoff, ...ts('2026-05-22') },
      { id: '00000000-0000-0000-0000-000000000903', expense_date: '2026-06-02', amount_cents: 64_250, description: 'Flights - grantee site visit (Boston)', category_id: ids.catTravel, vendor_contact_id: null, payment_method: 'reimbursement', status: 'pending', paid_by: ids.mike, is_1099_eligible: false, disbursement_id: null, notes: 'Mike fronted personally', entered_by: ids.mike, ...ts('2026-06-02') },
      { id: '00000000-0000-0000-0000-000000000904', expense_date: '2026-05-15', amount_cents: 1_000_000, description: 'Grant disbursement - BioSafety Lab Collective: Community biosafety training program', category_id: ids.catGrants, vendor_contact_id: ids.granteeLab, payment_method: 'wire', status: 'paid', paid_by: null, is_1099_eligible: false, disbursement_id: ids.disb1, notes: null, entered_by: ids.nick, ...ts('2026-05-15') },
    ],
    bio_grant_proposals: [
      { id: ids.proposal1, applicant_contact_id: ids.granteeLab, title: 'Community biosafety training program', summary: 'Twelve-month training program for community lab biosafety officers across 20 cities.', program_area: 'Biosafety', amount_requested_cents: 5_000_000, received_date: '2026-03-01', source: 'email', status: 'decided', decision: 'approved', decision_date: '2026-04-15', decision_notes: 'Strong team, clear milestones. Approved at requested amount less travel line.', ...ts('2026-03-01') },
      { id: ids.proposal2, applicant_contact_id: ids.granteeWatch, title: 'Open wastewater surveillance dashboard', summary: 'Public dashboard aggregating municipal wastewater pathogen signals with open methodology.', program_area: 'Biosurveillance', amount_requested_cents: 7_500_000, received_date: '2026-05-20', source: 'referral', status: 'in_review', decision: null, decision_date: null, decision_notes: null, ...ts('2026-05-20') },
    ],
    bio_proposal_reviews: [
      { id: '00000000-0000-0000-0000-000000000a01', proposal_id: ids.proposal2, reviewer_id: ids.mike, score: 4, vote: 'yes', comments: 'Team has shipped similar dashboards before. Budget is reasonable.', recused: false, ...ts('2026-06-01') },
      { id: '00000000-0000-0000-0000-000000000a02', proposal_id: ids.proposal2, reviewer_id: ids.geoff, score: 3, vote: 'maybe', comments: 'Worried about municipal data agreements - want to see at least 3 signed LOIs.', recused: false, ...ts('2026-06-03') },
    ],
    bio_proposal_comments: [
      { id: '00000000-0000-0000-0000-000000000b01', proposal_id: ids.proposal2, author_id: ids.mike, body: 'Spoke with their CTO on Tuesday - they already have data-sharing agreements with Boston and Cambridge.', ...ts('2026-06-02') },
      { id: '00000000-0000-0000-0000-000000000b02', proposal_id: ids.proposal2, author_id: ids.geoff, body: 'Good - two down. Let us ask for one more before deciding.', ...ts('2026-06-04') },
    ],
    bio_proposal_memos: [
      {
        id: '00000000-0000-0000-0000-000000000d01',
        proposal_id: ids.proposal2,
        q_candidate_background: 'Founding team built the COVID wastewater dashboard for the Boston Public Health Commission. Two PhDs in environmental engineering.',
        q_values_alignment: 'Open methodology, public-good orientation. No commercial pivot in their roadmap.',
        q_cause_area: 'Biosurveillance / pandemic preparedness — early signal detection for novel pathogens.',
        q_theory_of_change: 'Free public dashboard + open API lowers the bar for downstream researchers and health departments to act on wastewater signals.',
        q_output_product: 'Public web dashboard covering 25+ municipalities by month 12, plus a documented JSON API.',
        q_amount_justification: '$75k covers two engineers half-time for 12 months plus hosting. Reasonable for the scope.',
        q_counterfactual: null,
        q_success_outcomes: null,
        q_disappointing_outcomes: null,
        q_org_benefit: null,
        q_me_plan: null,
        q_risks: null,
        q_legal_reputational_risks: null,
        q_success_measurement: null,
        q_open_questions: null,
        started_by: ids.mike,
        last_edited_by: ids.mike,
        ...ts('2026-06-05'),
      },
    ],
    bio_grants_out: [
      { id: ids.award1, proposal_id: ids.proposal1, grantee_contact_id: ids.granteeLab, purpose: 'Community biosafety training program', amount_awarded_cents: 4_500_000, award_date: '2026-04-15', restriction: 'Program use only', agreement_signed_date: '2026-04-28', status: 'active', notes: null, ...ts('2026-04-15') },
    ],
    bio_disbursements: [
      { id: ids.disb1, grant_out_id: ids.award1, amount_cents: 1_000_000, scheduled_date: '2026-05-15', paid_date: '2026-05-15', method: 'wire', status: 'paid', ...ts('2026-04-28') },
      { id: ids.disb2, grant_out_id: ids.award1, amount_cents: 1_750_000, scheduled_date: '2026-07-01', paid_date: null, method: 'wire', status: 'scheduled', ...ts('2026-04-28') },
    ],
    bio_grantee_reports: [
      { id: '00000000-0000-0000-0000-000000000c01', grant_out_id: ids.award1, report_type: 'progress', due_date: '2026-06-30', received_date: null, status: 'upcoming', notes: 'First quarterly progress report', ...ts('2026-04-28') },
      { id: '00000000-0000-0000-0000-000000000c02', grant_out_id: ids.award1, report_type: 'final', due_date: '2027-04-30', received_date: null, status: 'upcoming', notes: null, ...ts('2026-04-28') },
    ],
    bio_grants_in: [
      { id: ids.grantIn1, funder_contact_id: ids.funderOpen, opportunity_name: 'Biosecurity Field Building 2026', program: 'Global Catastrophic Risks', amount_requested_cents: 25_000_000, amount_awarded_cents: null, status: 'preparing', application_deadline: '2026-07-15', submitted_date: null, decision_date: null, grant_period_start: null, grant_period_end: null, restriction: 'unrestricted', owner_id: ids.nick, notes: 'Draft narrative 60% done.', ...ts('2026-05-10') },
    ],
    bio_grants_in_deliverables: [],
    bio_attachments: [],
    bio_donation_inquiries: [
      { id: ids.inquiry1, name: 'Priya Raman', email: 'priya.raman@example.com', phone: '415-555-0142', organization: null, gift_method: 'stock_crypto', amount_cents: 5_000_000, amount_text: '50000', message: 'Interested in gifting appreciated shares before year end — what do you need from me?', status: 'new', source: 'website', ...ts('2026-06-22') },
      { id: ids.inquiry2, name: 'Daniel Okafor', email: 'dokafor@brightpath.org', phone: null, organization: 'Brightpath Family Foundation', gift_method: 'daf', amount_cents: null, amount_text: 'TBD — likely $10k–25k', message: 'Recommending a grant through our DAF; please confirm legal name and EIN.', status: 'contacted', source: 'website', ...ts('2026-06-18') },
    ],
  }
}

const globalKey = Symbol.for('saif-bio.demo-store')

type GlobalWithStore = typeof globalThis & { [globalKey]?: DemoStore }

/** Singleton store surviving HMR / repeated imports within a server instance */
export function getDemoStore(): DemoStore {
  const g = globalThis as GlobalWithStore
  if (!g[globalKey]) {
    g[globalKey] = { tables: buildSeedTables(), files: new Map() }
  }
  return g[globalKey]
}
