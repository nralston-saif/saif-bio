'use client'

import { useTransition } from 'react'
import { markDeliverableSubmitted } from '@/lib/actions/grants-in'
import { useToast } from '@/components/Toast'

interface DeliverableActionsProps {
  deliverableId: string
  grantInId: string
}

export default function DeliverableActions({ deliverableId, grantInId }: DeliverableActionsProps) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleMarkSubmitted = () => {
    startTransition(async () => {
      try {
        await markDeliverableSubmitted(deliverableId, grantInId)
        showToast('Deliverable marked submitted', 'success')
      } catch (err) {
        if (
          err instanceof Error &&
          'digest' in err &&
          typeof (err as { digest?: unknown }).digest === 'string' &&
          (err as { digest: string }).digest.startsWith('NEXT_REDIRECT')
        ) {
          throw err
        }
        showToast(err instanceof Error ? err.message : 'Could not update deliverable', 'error')
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleMarkSubmitted}
      disabled={isPending}
      className="btn btn-secondary text-xs"
    >
      {isPending ? 'Saving…' : 'Mark submitted'}
    </button>
  )
}
