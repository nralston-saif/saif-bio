'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import { parseDollarsToCents } from '@/lib/utils/money'
import { todayISO } from '@/lib/utils/dates'
import type {
  GranteeReportStatus,
  GranteeReportType,
  GrantOutStatus,
  ProposalDecision,
  ProposalStatus,
  Vote,
} from '@/lib/supabase/types/database'

function parseOptionalCents(formData: FormData, key: string): number | null {
  const input = optionalString(formData, key)
  if (input === null) return null
  const cents = parseDollarsToCents(input)
  if (cents === null) throw new ActionError(`Invalid amount: ${key}`)
  return cents
}

// --- Proposals ---

function proposalFields(formData: FormData) {
  return {
    applicant_contact_id: requiredString(formData, 'applicant_contact_id'),
    title: requiredString(formData, 'title'),
    summary: optionalString(formData, 'summary'),
    program_area: optionalString(formData, 'program_area'),
    amount_requested_cents: parseOptionalCents(formData, 'amount_requested'),
    received_date: optionalString(formData, 'received_date'),
    source: optionalString(formData, 'source'),
  }
}

export async function createProposal(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bio_grant_proposals')
    .insert(proposalFields(formData))
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-out')
  redirect(`/grants-out/proposals/${data.id}`)
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
    await supabase.from('bio_expenses').insert({
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

export async function addGranteeReport(awardId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase.from('bio_grantee_reports').insert({
    grant_out_id: awardId,
    report_type: requiredString(formData, 'report_type') as GranteeReportType,
    due_date: requiredString(formData, 'due_date'),
    notes: optionalString(formData, 'notes'),
  })

  if (error) throw new ActionError(error.message)
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
