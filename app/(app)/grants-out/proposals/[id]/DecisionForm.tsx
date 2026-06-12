'use client'

import { useState, useTransition, type FormEvent } from 'react'
import { recordDecision } from '@/lib/actions/grants-out'
import { useToast } from '@/components/Toast'
import MoneyInput from '@/components/MoneyInput'
import type { ProposalDecision } from '@/lib/supabase/types/database'

export default function DecisionForm({
  proposalId,
  requestedAmount,
}: {
  proposalId: string
  /** Requested amount as a dollar string (may be empty) to prefill the award amount. */
  requestedAmount: string
}) {
  const [decision, setDecision] = useState<ProposalDecision | null>(null)
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!decision) return
    const message =
      decision === 'approved'
        ? 'Approve this proposal? An award will be created.'
        : 'Decline this proposal?'
    if (!confirm(message)) return

    const formData = new FormData(e.currentTarget)
    startTransition(async () => {
      try {
        await recordDecision(proposalId, formData)
        showToast('Decision recorded', 'success')
      } catch (err) {
        if ((err as Error & { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')) throw err
        showToast(err instanceof Error ? err.message : 'Could not record decision', 'error')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="decision"
            value="approved"
            required
            checked={decision === 'approved'}
            onChange={() => setDecision('approved')}
          />
          Approve
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="radio"
            name="decision"
            value="declined"
            checked={decision === 'declined'}
            onChange={() => setDecision('declined')}
          />
          Decline
        </label>
      </div>

      {decision === 'approved' && (
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Amount awarded</label>
          <MoneyInput
            name="amount_awarded"
            defaultValue={requestedAmount}
            required={requestedAmount === ''}
          />
        </div>
      )}

      <div>
        <label htmlFor="decision_notes" className="block text-xs font-medium text-gray-500 mb-1">
          Decision notes
        </label>
        <textarea id="decision_notes" name="decision_notes" rows={3} className="input" />
      </div>

      <button
        type="submit"
        disabled={isPending || !decision}
        className="btn btn-primary w-full"
      >
        {isPending ? 'Recording…' : 'Record decision'}
      </button>
    </form>
  )
}
