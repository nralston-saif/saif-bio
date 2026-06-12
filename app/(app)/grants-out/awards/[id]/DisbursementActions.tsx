'use client'

import { useTransition } from 'react'
import { markDisbursementPaid, cancelDisbursement } from '@/lib/actions/grants-out'
import { useToast } from '@/components/Toast'

export default function DisbursementActions({
  disbursementId,
  awardId,
}: {
  disbursementId: string
  awardId: string
}) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleMarkPaid = () => {
    if (!confirm('Mark this disbursement as paid? A matching expense will be created.')) return
    startTransition(async () => {
      try {
        await markDisbursementPaid(disbursementId)
        showToast('Disbursement marked paid', 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not mark paid', 'error')
      }
    })
  }

  const handleCancel = () => {
    startTransition(async () => {
      try {
        await cancelDisbursement(disbursementId, awardId)
        showToast('Disbursement cancelled', 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not cancel', 'error')
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={handleMarkPaid}
        disabled={isPending}
        className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
      >
        Mark paid
      </button>
      <button
        type="button"
        onClick={handleCancel}
        disabled={isPending}
        className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  )
}
