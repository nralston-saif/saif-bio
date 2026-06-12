'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import { parseDollarsToCents } from '@/lib/utils/money'
import { todayISO } from '@/lib/utils/dates'
import type {
  DeliverableType,
  GrantInStatus,
  Restriction,
} from '@/lib/supabase/types/database'

function parseOptionalCents(formData: FormData, key: string): number | null {
  const input = optionalString(formData, key)
  if (input === null) return null
  const cents = parseDollarsToCents(input)
  if (cents === null) throw new ActionError(`Invalid amount: ${key}`)
  return cents
}

function grantInFields(formData: FormData) {
  return {
    funder_contact_id: requiredString(formData, 'funder_contact_id'),
    opportunity_name: requiredString(formData, 'opportunity_name'),
    program: optionalString(formData, 'program'),
    amount_requested_cents: parseOptionalCents(formData, 'amount_requested'),
    amount_awarded_cents: parseOptionalCents(formData, 'amount_awarded'),
    status: (optionalString(formData, 'status') ?? 'prospect') as GrantInStatus,
    application_deadline: optionalString(formData, 'application_deadline'),
    submitted_date: optionalString(formData, 'submitted_date'),
    decision_date: optionalString(formData, 'decision_date'),
    grant_period_start: optionalString(formData, 'grant_period_start'),
    grant_period_end: optionalString(formData, 'grant_period_end'),
    restriction: optionalString(formData, 'restriction') as Restriction | null,
    owner_id: optionalString(formData, 'owner_id'),
    notes: optionalString(formData, 'notes'),
  }
}

export async function createGrantIn(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bio_grants_in')
    .insert(grantInFields(formData))
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-in')
  redirect(`/grants-in/${data.id}`)
}

export async function updateGrantIn(grantInId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_grants_in')
    .update(grantInFields(formData))
    .eq('id', grantInId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/grants-in')
  revalidatePath(`/grants-in/${grantInId}`)
}

export async function addDeliverable(grantInId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase.from('bio_grants_in_deliverables').insert({
    grant_in_id: grantInId,
    title: requiredString(formData, 'title'),
    deliverable_type: requiredString(formData, 'deliverable_type') as DeliverableType,
    due_date: requiredString(formData, 'due_date'),
  })

  if (error) throw new ActionError(error.message)
  revalidatePath(`/grants-in/${grantInId}`)
}

export async function markDeliverableSubmitted(deliverableId: string, grantInId: string) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_grants_in_deliverables')
    .update({ status: 'submitted', submitted_date: todayISO() })
    .eq('id', deliverableId)

  if (error) throw new ActionError(error.message)
  revalidatePath(`/grants-in/${grantInId}`)
}
