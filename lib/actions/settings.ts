'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'

export async function updateSettings(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const fiscalYearStartMonth = Number(optionalString(formData, 'fiscal_year_start_month') ?? '1')
  if (!Number.isInteger(fiscalYearStartMonth) || fiscalYearStartMonth < 1 || fiscalYearStartMonth > 12) {
    throw new ActionError('Fiscal year start month must be 1-12')
  }

  const { error } = await supabase
    .from('bio_settings')
    .update({
      org_legal_name: requiredString(formData, 'org_legal_name'),
      ein: optionalString(formData, 'ein'),
      address_line1: optionalString(formData, 'address_line1'),
      address_line2: optionalString(formData, 'address_line2'),
      city: optionalString(formData, 'city'),
      state: optionalString(formData, 'state'),
      postal_code: optionalString(formData, 'postal_code'),
      fiscal_year_start_month: fiscalYearStartMonth,
      letter_signatory_name: optionalString(formData, 'letter_signatory_name'),
      letter_signatory_title: optionalString(formData, 'letter_signatory_title'),
      letter_from_email: optionalString(formData, 'letter_from_email'),
      letter_closing_text:
        optionalString(formData, 'letter_closing_text') ??
        'Thank you for your generous support of our mission.',
    })
    .eq('id', 1)

  if (error) throw new ActionError(error.message)

  revalidatePath('/settings')
}
