import type { ContactTaxStatus } from '@/lib/supabase/types/database'

export const TAX_STATUS_LABELS: Record<ContactTaxStatus, string> = {
  '501c3_public_charity': '501(c)(3) public charity',
  '501c3_private_foundation': '501(c)(3) private foundation',
  other_nonprofit: 'Other nonprofit',
  government: 'Government entity',
  for_profit: 'For-profit',
  individual: 'Individual',
}

export const TAX_STATUS_OPTIONS = Object.entries(TAX_STATUS_LABELS) as [
  ContactTaxStatus,
  string,
][]
