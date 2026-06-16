import type { ContactType } from '@/lib/supabase/types/database'

export interface NewVendorInput {
  display_name: string
  contact_type: ContactType
  tax_id?: string | null
  w9_on_file?: boolean
}

/**
 * Pure mapping from the inline "add vendor" form to a bio_contacts insert.
 * Always flags the contact as a vendor. Kept import-free (type-only) so it can
 * be unit-tested without the server-action runtime.
 */
export function vendorFieldsFromInput(input: NewVendorInput) {
  const taxId = input.tax_id?.trim()
  return {
    contact_type: (input.contact_type === 'individual' ? 'individual' : 'organization') as ContactType,
    display_name: input.display_name.trim(),
    is_vendor: true as const,
    tax_id: taxId ? taxId : null,
    w9_on_file: Boolean(input.w9_on_file),
  }
}
