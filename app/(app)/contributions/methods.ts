import type { ContributionMethod } from '@/lib/supabase/types/database'

export const METHOD_LABELS: Record<ContributionMethod, string> = {
  check: 'Check',
  ach: 'ACH',
  wire: 'Wire',
  credit_card: 'Credit card',
  stock: 'Stock',
  crypto: 'Crypto',
  in_kind: 'In-kind',
}
