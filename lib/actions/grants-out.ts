'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import { parseDollarsToCents } from '@/lib/utils/money'
import { todayISO, todayPacificISO } from '@/lib/utils/dates'
import type { SupabaseClient } from '@supabase/supabase-js'
import { syncExpenseToQbo } from '@/lib/quickbooks/sync'
import type {
  Database,
  DisbursementStatus,
  GranteeReportStatus,
  GranteeReportType,
  GrantOutStatus,
  Pillar,
  ProposalDecision,
  ProposalMemo,
  ProposalStatus,
  Vote,
} from '@/lib/supabase/types/database'
import { PILLARS } from '@/lib/supabase/types/database'
import { MEMO_RUBRIC_FIELDS, isMemoComplete } from '@/lib/grants/memo'

function parseOptionalCents(formData: FormData, key: string): number | null {
  const input = optionalString(formData, key)
  if (input === null) return null
  const cents = parseDollarsToCents(input)
  if (cents === null) throw new ActionError(`Invalid amount: ${key}`)
  return cents
}

// --- Proposals ---

function pillarsFromForm(formData: FormData): Pillar[] {
  const allowed = new Set<string>(PILLARS)
  const raw = formData.getAll('pillars').filter((v): v is string => typeof v === 'string')
  const picked = raw.filter((v) => allowed.has(v)) as Pillar[]
  // De-dupe while preserving order
  return Array.from(new Set(picked))
}

function proposalFields(formData: FormData) {
  const amountCents = parseOptionalCents(formData, 'amount_requested')
  if (amountCents === null) {
    throw new ActionError('Amount requested/suggested is required')
  }
  return {
    applicant_contact_id: requiredString(formData, 'applicant_contact_id'),
    title: requiredString(formData, 'title'),
    summary: optionalString(formData, 'summary'),
    pillars: pillarsFromForm(formData),
    amount_requested_cents: amountCents,
    received_date: optionalString(formData, 'received_date'),
    source: optionalString(formData, 'source'),
  }
}

/**
 * Insert payload for a brand-new proposal. Adds the create-only stamps
 * (entered_date and initial status) so the row is well-formed even on
 * backends that don't honor DB-level defaults (i.e. demo mode).
 */
function newProposalFields(formData: FormData) {
  return {
    ...proposalFields(formData),
    entered_date: todayPacificISO(),
    status: 'received' as ProposalStatus,
  }
}

export async function createProposal(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bio_grant_proposals')
    .insert(newProposalFields(formData))
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-out')
  redirect(`/grants-out/proposals/${data.id}`)
}

const MAX_LETTER_BYTES = 10 * 1024 * 1024

/**
 * Same as createProposal but also attaches the uploaded proposal letter
 * to the new proposal. When the Claude extraction lands later it will
 * pre-fill the form fields from the same file before this action runs.
 */
export async function createProposalWithLetter(formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    throw new ActionError('Please attach the proposal letter')
  }
  if (file.size > MAX_LETTER_BYTES) {
    throw new ActionError('File exceeds 10 MB limit')
  }

  const { data: proposal, error } = await supabase
    .from('bio_grant_proposals')
    .insert(newProposalFields(formData))
    .select('id')
    .single()
  if (error) throw new ActionError(error.message)

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `grant_proposal/${proposal.id}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type || undefined })
  if (uploadError) throw new ActionError(`Upload failed: ${uploadError.message}`)

  const { error: insertError } = await supabase.from('bio_attachments').insert({
    entity_type: 'grant_proposal',
    entity_id: proposal.id,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: memberId,
  })
  if (insertError) {
    await supabase.storage.from('documents').remove([storagePath])
    throw new ActionError(`Failed to record attachment: ${insertError.message}`)
  }

  revalidatePath('/grants-out')
  redirect(`/grants-out/proposals/${proposal.id}`)
}

export async function updateProposal(proposalId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_grant_proposals')
    .update(proposalFields(formData))
    .eq('id', proposalId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-out')
  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

export async function setProposalStatus(proposalId: string, status: ProposalStatus) {
  await requireMemberId()
  const supabase = await createClient()

  if (status === 'decided') {
    throw new ActionError('Use recordDecision to decide a proposal')
  }

  const { error } = await supabase
    .from('bio_grant_proposals')
    .update({ status })
    .eq('id', proposalId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-out')
  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

// --- Reviews (each partner writes only their own row; RLS enforces) ---

export async function submitReview(proposalId: string, formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const recused = formData.get('recused') === 'on'
  const scoreInput = optionalString(formData, 'score')
  const voteInput = optionalString(formData, 'vote') as Vote | null

  const { error } = await supabase.from('bio_proposal_reviews').upsert(
    {
      proposal_id: proposalId,
      reviewer_id: memberId,
      score: recused ? null : scoreInput ? Number(scoreInput) : null,
      vote: recused ? null : voteInput,
      comments: optionalString(formData, 'comments'),
      recused,
    },
    { onConflict: 'proposal_id,reviewer_id' }
  )

  if (error) throw new ActionError(error.message)

  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

export async function addComment(proposalId: string, formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase.from('bio_proposal_comments').insert({
    proposal_id: proposalId,
    author_id: memberId,
    body: requiredString(formData, 'body'),
  })

  if (error) throw new ActionError(error.message)

  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

// --- Evaluation memo (one per proposal, gates recordDecision) ---

function memoFields(formData: FormData): Partial<ProposalMemo> {
  const out: Partial<ProposalMemo> = {}
  for (const [key] of MEMO_RUBRIC_FIELDS) {
    out[key] = optionalString(formData, key)
  }
  return out
}

export async function startMemo(proposalId: string) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('bio_proposal_memos')
    .select('id')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  if (existing) {
    revalidatePath(`/grants-out/proposals/${proposalId}`)
    return
  }

  const { error } = await supabase.from('bio_proposal_memos').insert({
    proposal_id: proposalId,
    started_by: memberId,
    last_edited_by: memberId,
  })

  if (error) throw new ActionError(error.message)
  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

export async function updateMemo(proposalId: string, formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('bio_proposal_memos')
    .select('id, started_by')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('bio_proposal_memos')
      .update({ ...memoFields(formData), last_edited_by: memberId })
      .eq('proposal_id', proposalId)
    if (error) throw new ActionError(error.message)
  } else {
    const { error } = await supabase.from('bio_proposal_memos').insert({
      proposal_id: proposalId,
      ...memoFields(formData),
      started_by: memberId,
      last_edited_by: memberId,
    })
    if (error) throw new ActionError(error.message)
  }

  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

// --- Decision -> award ---

export async function recordDecision(proposalId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const decision = requiredString(formData, 'decision') as ProposalDecision
  const decisionNotes = optionalString(formData, 'decision_notes')

  const { data: proposal, error: loadError } = await supabase
    .from('bio_grant_proposals')
    .select('*')
    .eq('id', proposalId)
    .single()

  if (loadError || !proposal) throw new ActionError('Proposal not found')

  const { data: memo } = await supabase
    .from('bio_proposal_memos')
    .select('*')
    .eq('proposal_id', proposalId)
    .maybeSingle()

  if (!isMemoComplete(memo)) {
    throw new ActionError(
      'Evaluation memo must be fully filled in (all 15 rubric questions) before recording a decision'
    )
  }

  const { error } = await supabase
    .from('bio_grant_proposals')
    .update({
      status: 'decided',
      decision,
      decision_date: todayISO(),
      decision_notes: decisionNotes,
    })
    .eq('id', proposalId)

  if (error) throw new ActionError(error.message)

  if (decision === 'approved') {
    const awardedCents =
      parseOptionalCents(formData, 'amount_awarded') ?? proposal.amount_requested_cents
    if (awardedCents === null) {
      throw new ActionError('Awarded amount is required to approve')
    }

    const { data: award, error: awardError } = await supabase
      .from('bio_grants_out')
      .insert({
        proposal_id: proposalId,
        grantee_contact_id: proposal.applicant_contact_id,
        purpose: proposal.title,
        amount_awarded_cents: awardedCents,
        award_date: todayISO(),
        status: 'awarded',
      })
      .select('id')
      .single()

    if (awardError) throw new ActionError(awardError.message)

    revalidatePath('/grants-out')
    redirect(`/grants-out/awards/${award.id}`)
  }

  revalidatePath('/grants-out')
  revalidatePath(`/grants-out/proposals/${proposalId}`)
}

// --- Awards ---

export async function createAward(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const awardedCents = parseOptionalCents(formData, 'amount_awarded')
  if (awardedCents === null) throw new ActionError('Awarded amount is required')

  const { data, error } = await supabase
    .from('bio_grants_out')
    .insert({
      grantee_contact_id: requiredString(formData, 'grantee_contact_id'),
      purpose: optionalString(formData, 'purpose'),
      amount_awarded_cents: awardedCents,
      award_date: optionalString(formData, 'award_date'),
      restriction: optionalString(formData, 'restriction'),
      agreement_signed_date: optionalString(formData, 'agreement_signed_date'),
      notes: optionalString(formData, 'notes'),
      status: 'awarded' as GrantOutStatus,
    })
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-out')
  redirect(`/grants-out/awards/${data.id}`)
}

export async function setAwardStatus(awardId: string, status: GrantOutStatus) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase.from('bio_grants_out').update({ status }).eq('id', awardId)
  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-out')
  revalidatePath(`/grants-out/awards/${awardId}`)
}

// --- Disbursements ---

export async function addDisbursement(awardId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const amountCents = parseOptionalCents(formData, 'amount')
  if (amountCents === null) throw new ActionError('Amount is required')

  const { error } = await supabase.from('bio_disbursements').insert({
    grant_out_id: awardId,
    amount_cents: amountCents,
    scheduled_date: optionalString(formData, 'scheduled_date'),
    method: optionalString(formData, 'method') as 'check' | 'ach' | 'wire' | null,
    status: 'scheduled' as DisbursementStatus,
  })

  if (error) throw new ActionError(error.message)

  revalidatePath(`/grants-out/awards/${awardId}`)
}

/**
 * Mark a disbursement paid and auto-create the matching expense row in the
 * "Grants paid" category so functional expense totals stay complete.
 */
export async function markDisbursementPaid(disbursementId: string) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { data: disbursement, error: loadError } = await supabase
    .from('bio_disbursements')
    .select('*')
    .eq('id', disbursementId)
    .single()

  if (loadError || !disbursement) throw new ActionError('Disbursement not found')
  if (disbursement.status === 'paid') throw new ActionError('Already marked paid')

  const { data: award } = await supabase
    .from('bio_grants_out')
    .select('id, purpose, grantee_contact_id')
    .eq('id', disbursement.grant_out_id)
    .single()

  const { data: granteeContact } = award
    ? await supabase
        .from('bio_contacts')
        .select('display_name')
        .eq('id', award.grantee_contact_id)
        .maybeSingle()
    : { data: null }

  const paidDate = todayISO()

  const { error: updateError } = await supabase
    .from('bio_disbursements')
    .update({ status: 'paid', paid_date: paidDate })
    .eq('id', disbursementId)

  if (updateError) throw new ActionError(updateError.message)

  const { data: grantsPaidCategory } = await supabase
    .from('bio_expense_categories')
    .select('id')
    .eq('name', 'Grants paid')
    .single()

  if (grantsPaidCategory) {
    const { data: created } = await supabase
      .from('bio_expenses')
      .insert({
        expense_date: paidDate,
        amount_cents: disbursement.amount_cents,
        description: `Grant disbursement - ${granteeContact?.display_name ?? 'grantee'}${award?.purpose ? `: ${award.purpose}` : ''}`,
        category_id: grantsPaidCategory.id,
        vendor_contact_id: award?.grantee_contact_id ?? null,
        payment_method: disbursement.method,
        status: 'paid',
        disbursement_id: disbursementId,
        entered_by: memberId,
      })
      .select('id')
      .single()

    if (created) await syncExpenseToQbo(supabase, created.id)
  }

  revalidatePath(`/grants-out/awards/${disbursement.grant_out_id}`)
  revalidatePath('/expenses')
}

export async function cancelDisbursement(disbursementId: string, awardId: string) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_disbursements')
    .update({ status: 'cancelled' })
    .eq('id', disbursementId)
    .eq('status', 'scheduled')

  if (error) throw new ActionError(error.message)
  revalidatePath(`/grants-out/awards/${awardId}`)
}

// --- Grantee reports ---

const MAX_REPORT_FILE_BYTES = 10 * 1024 * 1024

/** Upload a grantee report document and write the matching bio_attachments row. */
async function attachReportFile(
  supabase: SupabaseClient<Database>,
  memberId: string,
  reportId: string,
  file: File
): Promise<void> {
  if (file.size > MAX_REPORT_FILE_BYTES) {
    throw new ActionError('File exceeds 10 MB limit')
  }
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const storagePath = `grantee_report/${reportId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, file, { contentType: file.type || undefined })
  if (uploadError) throw new ActionError(`Upload failed: ${uploadError.message}`)

  const { error: insertError } = await supabase.from('bio_attachments').insert({
    entity_type: 'grantee_report',
    entity_id: reportId,
    storage_path: storagePath,
    file_name: file.name,
    mime_type: file.type || null,
    size_bytes: file.size,
    uploaded_by: memberId,
  })
  if (insertError) {
    await supabase.storage.from('documents').remove([storagePath])
    throw new ActionError(`Failed to record attachment: ${insertError.message}`)
  }
}

export async function addGranteeReport(awardId: string, formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { data: report, error } = await supabase
    .from('bio_grantee_reports')
    .insert({
      grant_out_id: awardId,
      report_type: requiredString(formData, 'report_type') as GranteeReportType,
      due_date: requiredString(formData, 'due_date'),
      notes: optionalString(formData, 'notes'),
      status: 'upcoming' as GranteeReportStatus,
    })
    .select('id')
    .single()
  if (error || !report) throw new ActionError(error?.message ?? 'Could not create report')

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    await attachReportFile(supabase, memberId, report.id, file)
  }

  revalidatePath(`/grants-out/awards/${awardId}`)
}

/**
 * Mark a report received, stamp the date, and optionally attach the document
 * the grantee sent in. Used in place of setGranteeReportStatus(...,'received')
 * so the file upload happens in the same call.
 */
export async function markReportReceived(
  reportId: string,
  awardId: string,
  formData: FormData
) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_grantee_reports')
    .update({
      status: 'received' as GranteeReportStatus,
      received_date: todayISO(),
    })
    .eq('id', reportId)
  if (error) throw new ActionError(error.message)

  const file = formData.get('file')
  if (file instanceof File && file.size > 0) {
    await attachReportFile(supabase, memberId, reportId, file)
  }

  revalidatePath(`/grants-out/awards/${awardId}`)
}

export async function setGranteeReportStatus(
  reportId: string,
  awardId: string,
  status: GranteeReportStatus
) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_grantee_reports')
    .update({
      status,
      received_date: status === 'received' ? todayISO() : null,
    })
    .eq('id', reportId)

  if (error) throw new ActionError(error.message)
  revalidatePath(`/grants-out/awards/${awardId}`)
}

/**
 * Delete a grantee report along with any uploaded documents (storage files +
 * bio_attachments rows). For "added by mistake" cleanup.
 */
export async function deleteGranteeReport(reportId: string, awardId: string) {
  await requireMemberId()
  const supabase = await createClient()

  const { data: atts } = await supabase
    .from('bio_attachments')
    .select('id, storage_path')
    .eq('entity_type', 'grantee_report')
    .eq('entity_id', reportId)

  if (atts && atts.length > 0) {
    await supabase.storage.from('documents').remove(atts.map((a) => a.storage_path))
    await supabase
      .from('bio_attachments')
      .delete()
      .eq('entity_type', 'grantee_report')
      .eq('entity_id', reportId)
  }

  const { error } = await supabase.from('bio_grantee_reports').delete().eq('id', reportId)
  if (error) throw new ActionError(error.message)

  revalidatePath(`/grants-out/awards/${awardId}`)
}
