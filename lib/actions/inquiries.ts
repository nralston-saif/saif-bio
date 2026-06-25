'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, ActionError } from './helpers'
import type { DonationInquiryStatus } from '@/lib/supabase/types/database'

const STATUSES: DonationInquiryStatus[] = ['new', 'contacted', 'archived']

/** Triage a donation inquiry: new → contacted → archived. Partners only. */
export async function setInquiryStatus(
  inquiryId: string,
  status: DonationInquiryStatus
) {
  await requireMemberId()

  if (!STATUSES.includes(status)) {
    throw new ActionError(`Invalid status: ${status}`)
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('bio_donation_inquiries')
    .update({ status })
    .eq('id', inquiryId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/inquiries')
}
