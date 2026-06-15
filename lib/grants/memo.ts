import type { ProposalMemo } from '@/lib/supabase/types/database'

export const MEMO_RUBRIC_FIELDS = [
  ['q_candidate_background', 'How impressive is the candidate? What is their background?'],
  ['q_values_alignment', 'How values-aligned is the candidate?'],
  ['q_cause_area', 'What cause area / problem are they focused on?'],
  ['q_theory_of_change', 'What is their / our theory of change for the grant?'],
  ['q_output_product', 'What output / product have they agreed to create?'],
  ['q_amount_justification', 'How large is the grant — is the amount sensible and justified?'],
  ['q_counterfactual', 'Does the grant counterfactually enable high-impact work?'],
  ['q_success_outcomes', 'If successful, what would good outcomes look like?'],
  ['q_disappointing_outcomes', 'What would just-okay or disappointing outcomes look like?'],
  ['q_org_benefit', 'How does this benefit SAIF Bio or the broader community?'],
  ['q_me_plan', 'What is our monitoring & evaluation plan?'],
  ['q_risks', 'What are the major risks / failure modes?'],
  ['q_legal_reputational_risks', 'Are there legal or reputational risks?'],
  ['q_success_measurement', 'How might we measure success of this grant / grantee?'],
  ['q_open_questions', 'Remaining open questions / main cruxes?'],
] as const satisfies ReadonlyArray<readonly [keyof ProposalMemo, string]>

export type MemoRubricKey = (typeof MEMO_RUBRIC_FIELDS)[number][0]

export function isMemoComplete(memo: ProposalMemo | null | undefined): boolean {
  if (!memo) return false
  return MEMO_RUBRIC_FIELDS.every(([key]) => {
    const value = memo[key]
    return typeof value === 'string' && value.trim().length > 0
  })
}

export function memoAnsweredCount(memo: ProposalMemo | null | undefined): number {
  if (!memo) return 0
  return MEMO_RUBRIC_FIELDS.reduce((acc, [key]) => {
    const value = memo[key]
    return acc + (typeof value === 'string' && value.trim().length > 0 ? 1 : 0)
  }, 0)
}
