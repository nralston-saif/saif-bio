// Database types for the SAIF Bio Supabase project.
// Hand-written to match supabase/migrations; regenerate with `pnpm db:types`
// once the project is linked.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type ContactType = 'individual' | 'organization'
export type ContributionMethod =
  | 'check'
  | 'ach'
  | 'wire'
  | 'credit_card'
  | 'stock'
  | 'crypto'
  | 'in_kind'
export type Restriction = 'unrestricted' | 'donor_restricted'
export type LetterStatus = 'draft' | 'generated' | 'sent'
export type StockValuationSource = 'manual' | 'api_estimate' | 'broker_statement'
export type FunctionalClass = 'program' | 'management_general' | 'fundraising'
export type ExpensePaymentMethod = 'card' | 'check' | 'ach' | 'wire' | 'reimbursement'
export type ExpenseStatus = 'pending' | 'paid' | 'reimbursed'
export type ProposalStatus = 'received' | 'in_review' | 'decided' | 'withdrawn'
export type ProposalDecision = 'approved' | 'declined'
export type Vote = 'yes' | 'no' | 'maybe'
export type GrantOutStatus = 'awarded' | 'active' | 'completed' | 'terminated'
export type DisbursementStatus = 'scheduled' | 'paid' | 'cancelled'
export type GranteeReportType = 'progress' | 'final' | 'financial'
export type GranteeReportStatus = 'upcoming' | 'received' | 'overdue' | 'waived'
export type GrantInStatus =
  | 'prospect'
  | 'preparing'
  | 'submitted'
  | 'awarded'
  | 'declined'
  | 'withdrawn'
export type DeliverableType = 'narrative_report' | 'financial_report' | 'invoice' | 'other'
export type DeliverableStatus = 'upcoming' | 'submitted' | 'overdue'
export type AttachmentEntityType =
  | 'expense'
  | 'contribution'
  | 'grant_proposal'
  | 'grant_out'
  | 'grant_in'
  | 'grantee_report'
  | 'grant_in_deliverable'
  | 'contact'
  | 'governance'

type TimestampedRow = {
  created_at: string
  updated_at: string
}

export type TeamMember = TimestampedRow & {
  id: string
  auth_user_id: string | null
  email: string
  full_name: string
  is_active: boolean
}

export type Contact = TimestampedRow & {
  id: string
  contact_type: ContactType
  display_name: string
  org_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  country: string
  tax_id: string | null
  is_donor: boolean
  is_grantee: boolean
  is_funder: boolean
  is_vendor: boolean
  w9_on_file: boolean
  notes: string | null
}

export type Contribution = TimestampedRow & {
  id: string
  contact_id: string
  amount_cents: number | null
  received_date: string
  method: ContributionMethod
  in_kind_description: string | null
  restriction: Restriction
  restriction_purpose: string | null
  quid_pro_quo: boolean
  goods_services_description: string | null
  goods_services_value_cents: number | null
  check_number: string | null
  notes: string | null
  entered_by: string | null
}

export type AcknowledgementLetter = TimestampedRow & {
  id: string
  contribution_id: string
  status: LetterStatus
  pdf_storage_path: string | null
  body_snapshot: Json | null
  sent_to_email: string | null
  sent_at: string | null
  resend_message_id: string | null
  generated_by: string | null
}

export type SecurityPrice = TimestampedRow & {
  id: string
  symbol: string
  price_date: string
  open_cents: number | null
  high_cents: number | null
  low_cents: number | null
  close_cents: number
  adjusted_close_cents: number | null
  volume: number | null
  source: string
  fetched_at: string | null
}

export type StockContributionDetail = TimestampedRow & {
  contribution_id: string
  security_name: string
  ticker_symbol: string | null
  cusip: string | null
  shares: number
  valuation_date: string
  fmv_per_share_cents: number | null
  fmv_total_cents: number
  valuation_source: StockValuationSource
  market_price_source: string | null
  brokerage_account: string | null
  transfer_received_date: string | null
  sale_date: string | null
  sale_gross_cents: number | null
  sale_fees_cents: number | null
  sale_net_cents: number | null
  notes: string | null
}

export type ExpenseCategory = TimestampedRow & {
  id: string
  name: string
  functional_class: FunctionalClass
  form_990_line: string | null
  is_active: boolean
}

export type Expense = TimestampedRow & {
  id: string
  expense_date: string
  amount_cents: number
  description: string
  category_id: string
  vendor_contact_id: string | null
  payment_method: ExpensePaymentMethod | null
  status: ExpenseStatus
  paid_by: string | null
  is_1099_eligible: boolean
  disbursement_id: string | null
  notes: string | null
  entered_by: string | null
}

export type GrantProposal = TimestampedRow & {
  id: string
  applicant_contact_id: string
  title: string
  summary: string | null
  program_area: string | null
  amount_requested_cents: number | null
  received_date: string | null
  source: string | null
  status: ProposalStatus
  decision: ProposalDecision | null
  decision_date: string | null
  decision_notes: string | null
}

export type ProposalReview = TimestampedRow & {
  id: string
  proposal_id: string
  reviewer_id: string
  score: number | null
  vote: Vote | null
  comments: string | null
  recused: boolean
}

export type ProposalComment = TimestampedRow & {
  id: string
  proposal_id: string
  author_id: string
  body: string
}

export type ProposalMemo = TimestampedRow & {
  id: string
  proposal_id: string
  q_candidate_background: string | null
  q_values_alignment: string | null
  q_cause_area: string | null
  q_theory_of_change: string | null
  q_output_product: string | null
  q_amount_justification: string | null
  q_counterfactual: string | null
  q_success_outcomes: string | null
  q_disappointing_outcomes: string | null
  q_org_benefit: string | null
  q_me_plan: string | null
  q_risks: string | null
  q_legal_reputational_risks: string | null
  q_success_measurement: string | null
  q_open_questions: string | null
  started_by: string | null
  last_edited_by: string | null
}

export type GrantOut = TimestampedRow & {
  id: string
  proposal_id: string | null
  grantee_contact_id: string
  purpose: string | null
  amount_awarded_cents: number
  award_date: string | null
  restriction: string | null
  agreement_signed_date: string | null
  status: GrantOutStatus
  notes: string | null
}

export type Disbursement = TimestampedRow & {
  id: string
  grant_out_id: string
  amount_cents: number
  scheduled_date: string | null
  paid_date: string | null
  method: 'check' | 'ach' | 'wire' | null
  status: DisbursementStatus
}

export type GranteeReport = TimestampedRow & {
  id: string
  grant_out_id: string
  report_type: GranteeReportType
  due_date: string
  received_date: string | null
  status: GranteeReportStatus
  notes: string | null
}

export type GrantIn = TimestampedRow & {
  id: string
  funder_contact_id: string
  opportunity_name: string
  program: string | null
  amount_requested_cents: number | null
  amount_awarded_cents: number | null
  status: GrantInStatus
  application_deadline: string | null
  submitted_date: string | null
  decision_date: string | null
  grant_period_start: string | null
  grant_period_end: string | null
  restriction: Restriction | null
  owner_id: string | null
  notes: string | null
}

export type GrantInDeliverable = TimestampedRow & {
  id: string
  grant_in_id: string
  title: string
  deliverable_type: DeliverableType
  due_date: string
  submitted_date: string | null
  status: DeliverableStatus
}

export type Attachment = TimestampedRow & {
  id: string
  entity_type: AttachmentEntityType
  entity_id: string
  storage_path: string
  file_name: string
  mime_type: string | null
  size_bytes: number | null
  uploaded_by: string | null
}

export type Settings = TimestampedRow & {
  id: number
  org_legal_name: string
  ein: string | null
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  fiscal_year_start_month: number
  letter_signatory_name: string | null
  letter_signatory_title: string | null
  letter_from_email: string | null
  letter_closing_text: string
}

type TableDef<Row, Required extends keyof Row = never> = {
  Row: Row
  Insert: Partial<Row> & Pick<Row, Required>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      bio_team_members: TableDef<TeamMember, 'email' | 'full_name'>
      bio_contacts: TableDef<Contact, 'contact_type' | 'display_name'>
      bio_contributions: TableDef<Contribution, 'contact_id' | 'received_date' | 'method'>
      bio_acknowledgement_letters: TableDef<AcknowledgementLetter, 'contribution_id'>
      bio_security_prices: TableDef<SecurityPrice, 'symbol' | 'price_date' | 'close_cents' | 'source'>
      bio_stock_contribution_details: TableDef<StockContributionDetail, 'contribution_id' | 'security_name' | 'shares' | 'valuation_date' | 'fmv_total_cents'>
      bio_expense_categories: TableDef<ExpenseCategory, 'name' | 'functional_class'>
      bio_expenses: TableDef<Expense, 'expense_date' | 'amount_cents' | 'description' | 'category_id'>
      bio_grant_proposals: TableDef<GrantProposal, 'applicant_contact_id' | 'title'>
      bio_proposal_reviews: TableDef<ProposalReview, 'proposal_id' | 'reviewer_id'>
      bio_proposal_comments: TableDef<ProposalComment, 'proposal_id' | 'author_id' | 'body'>
      bio_proposal_memos: TableDef<ProposalMemo, 'proposal_id'>
      bio_grants_out: TableDef<GrantOut, 'grantee_contact_id' | 'amount_awarded_cents'>
      bio_disbursements: TableDef<Disbursement, 'grant_out_id' | 'amount_cents'>
      bio_grantee_reports: TableDef<GranteeReport, 'grant_out_id' | 'report_type' | 'due_date'>
      bio_grants_in: TableDef<GrantIn, 'funder_contact_id' | 'opportunity_name'>
      bio_grants_in_deliverables: TableDef<GrantInDeliverable, 'grant_in_id' | 'title' | 'deliverable_type' | 'due_date'>
      bio_attachments: TableDef<Attachment, 'entity_type' | 'entity_id' | 'storage_path' | 'file_name'>
      bio_settings: TableDef<Settings, never>
    }
    Views: Record<string, never>
    Functions: {
      bio_is_partner: { Args: Record<string, never>; Returns: boolean }
      bio_member_id: { Args: Record<string, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
