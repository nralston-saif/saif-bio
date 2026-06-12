'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import type { ContactType } from '@/lib/supabase/types/database'

function contactFields(formData: FormData) {
  return {
    contact_type: requiredString(formData, 'contact_type') as ContactType,
    display_name: requiredString(formData, 'display_name'),
    org_name: optionalString(formData, 'org_name'),
    first_name: optionalString(formData, 'first_name'),
    last_name: optionalString(formData, 'last_name'),
    email: optionalString(formData, 'email'),
    phone: optionalString(formData, 'phone'),
    address_line1: optionalString(formData, 'address_line1'),
    address_line2: optionalString(formData, 'address_line2'),
    city: optionalString(formData, 'city'),
    state: optionalString(formData, 'state'),
    postal_code: optionalString(formData, 'postal_code'),
    country: optionalString(formData, 'country') ?? 'US',
    tax_id: optionalString(formData, 'tax_id'),
    is_donor: formData.get('is_donor') === 'on',
    is_grantee: formData.get('is_grantee') === 'on',
    is_funder: formData.get('is_funder') === 'on',
    is_vendor: formData.get('is_vendor') === 'on',
    w9_on_file: formData.get('w9_on_file') === 'on',
    notes: optionalString(formData, 'notes'),
  }
}

export async function createContact(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bio_contacts')
    .insert(contactFields(formData))
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/contacts')
  redirect(`/contacts/${data.id}`)
}

export async function updateContact(contactId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_contacts')
    .update(contactFields(formData))
    .eq('id', contactId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/contacts')
  revalidatePath(`/contacts/${contactId}`)
}
