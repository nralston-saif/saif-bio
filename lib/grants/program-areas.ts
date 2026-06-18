/**
 * Program-area options for the "Program area" dropdown on the new-proposal form.
 *
 * PLACEHOLDER LIST — replace these with SAIF Bio's real program areas. The value
 * is stored as free text in bio_grant_proposals.program_area, so editing this
 * list never invalidates existing proposal rows. Program area is optional, so a
 * blank selection is allowed.
 */
export const PROGRAM_AREAS = [
  'Research',
  'Education & training',
  'Community programs',
  'Capacity building',
  'Other',
] as const
