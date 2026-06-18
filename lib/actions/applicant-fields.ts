import type { ContactType } from '@/lib/supabase/types/database'

export interface NewApplicantInput {
  display_name: string
  contact_type: ContactType
}

/**
 * Pure mapping from the inline "create applicant" affordance on the new
 * proposal form to a bio_contacts insert. Always flags the contact as a
 * grantee. Kept import-free (type-only) so it can be unit-tested without
 * the server-action runtime.
 */
export function applicantFieldsFromInput(input: NewApplicantInput) {
  return {
    contact_type: (input.contact_type === 'individual' ? 'individual' : 'organization') as ContactType,
    display_name: input.display_name.trim(),
    is_grantee: true as const,
  }
}
