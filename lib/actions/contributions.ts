'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import { parseDollarsToCents } from '@/lib/utils/money'
import type { ContributionMethod, Restriction } from '@/lib/supabase/types/database'

function contributionFields(formData: FormData) {
  const method = requiredString(formData, 'method') as ContributionMethod
  const quidProQuo = formData.get('quid_pro_quo') === 'on'

  const amountInput = optionalString(formData, 'amount')
  const amountCents = amountInput !== null ? parseDollarsToCents(amountInput) : null
  if (amountInput !== null && amountCents === null) {
    throw new ActionError('Invalid amount')
  }
  if (method !== 'in_kind' && amountCents === null) {
    throw new ActionError('Amount is required for cash contributions')
  }

  const inKindDescription = optionalString(formData, 'in_kind_description')
  if (method === 'in_kind' && !inKindDescription) {
    throw new ActionError('In-kind gifts require a description of the property')
  }

  let goodsServicesValueCents: number | null = null
  const goodsServicesDescription = optionalString(formData, 'goods_services_description')
  if (quidProQuo) {
    const gsInput = optionalString(formData, 'goods_services_value')
    goodsServicesValueCents = gsInput !== null ? parseDollarsToCents(gsInput) : null
    if (!goodsServicesDescription || goodsServicesValueCents === null) {
      throw new ActionError(
        'Quid pro quo contributions require a description and good-faith value of goods/services provided'
      )
    }
  }

  return {
    contact_id: requiredString(formData, 'contact_id'),
    amount_cents: amountCents,
    received_date: requiredString(formData, 'received_date'),
    method,
    in_kind_description: method === 'in_kind' ? inKindDescription : null,
    restriction: (optionalString(formData, 'restriction') ?? 'unrestricted') as Restriction,
    restriction_purpose: optionalString(formData, 'restriction_purpose'),
    quid_pro_quo: quidProQuo,
    goods_services_description: quidProQuo ? goodsServicesDescription : null,
    goods_services_value_cents: quidProQuo ? goodsServicesValueCents : null,
    check_number: optionalString(formData, 'check_number'),
    notes: optionalString(formData, 'notes'),
  }
}

export async function createContribution(formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bio_contributions')
    .insert({ ...contributionFields(formData), entered_by: memberId })
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/contributions')
  redirect(`/contributions/${data.id}`)
}

export async function updateContribution(contributionId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  // Don't allow edits once a letter has been sent - the letter snapshot
  // must continue to match what the donor received
  const { data: letter } = await supabase
    .from('bio_acknowledgement_letters')
    .select('status')
    .eq('contribution_id', contributionId)
    .maybeSingle()

  if (letter?.status === 'sent') {
    throw new ActionError(
      'This contribution has a sent acknowledgement letter and can no longer be edited'
    )
  }

  const { error } = await supabase
    .from('bio_contributions')
    .update(contributionFields(formData))
    .eq('id', contributionId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/contributions')
  revalidatePath(`/contributions/${contributionId}`)
}
