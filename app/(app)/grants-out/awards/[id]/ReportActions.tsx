'use client'

import { useTransition } from 'react'
import { setGranteeReportStatus } from '@/lib/actions/grants-out'
import { useToast } from '@/components/Toast'
import type { GranteeReportStatus } from '@/lib/supabase/types/database'

export default function ReportActions({
  reportId,
  awardId,
}: {
  reportId: string
  awardId: string
}) {
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const setStatus = (status: GranteeReportStatus, successMessage: string) => {
    startTransition(async () => {
      try {
        await setGranteeReportStatus(reportId, awardId, status)
        showToast(successMessage, 'success')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Could not update report', 'error')
      }
    })
  }

  return (
    <div className="flex items-center justify-end gap-3">
      <button
        type="button"
        onClick={() => setStatus('received', 'Report marked received')}
        disabled={isPending}
        className="text-xs font-medium text-green-700 hover:text-green-900 disabled:opacity-50"
      >
        Mark received
      </button>
      <button
        type="button"
        onClick={() => setStatus('waived', 'Report waived')}
        disabled={isPending}
        className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-50"
      >
        Waive
      </button>
    </div>
  )
}
