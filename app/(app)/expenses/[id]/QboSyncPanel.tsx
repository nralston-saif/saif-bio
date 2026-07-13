import { getConnection } from '@/lib/quickbooks/client'
import { retryExpenseSync } from '@/lib/actions/quickbooks'
import SubmitButton from '@/components/SubmitButton'
import { formatDate } from '@/lib/utils/dates'
import type { Expense } from '@/lib/supabase/types/database'

/** QuickBooks sync status + manual retry for one expense. Hidden until a company is connected. */
export default async function QboSyncPanel({ expense }: { expense: Expense }) {
  const connection = await getConnection()
  if (!connection) return null

  const badge =
    expense.qbo_sync_status === 'synced' ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Synced
      </span>
    ) : expense.qbo_sync_status === 'failed' ? (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
        Sync failed
      </span>
    ) : (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Not synced
      </span>
    )

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-gray-900">QuickBooks</h2>
            {badge}
          </div>
          {expense.qbo_sync_status === 'synced' && expense.qbo_synced_at && (
            <p className="text-xs text-gray-400 mt-1">
              Last synced {formatDate(expense.qbo_synced_at)}
            </p>
          )}
          {expense.qbo_sync_status === 'failed' && expense.qbo_sync_error && (
            <p className="text-xs text-red-600 mt-1 break-words">{expense.qbo_sync_error}</p>
          )}
        </div>
        <form action={retryExpenseSync.bind(null, expense.id)} className="shrink-0">
          <SubmitButton>
            {expense.qbo_sync_status === 'synced' ? 'Re-sync' : 'Sync now'}
          </SubmitButton>
        </form>
      </div>
    </div>
  )
}
