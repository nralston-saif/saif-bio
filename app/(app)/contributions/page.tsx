import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import type { Contribution, LetterStatus } from '@/lib/supabase/types/database'
import { METHOD_LABELS } from './methods'

function RestrictionBadge({ restriction }: { restriction: string }) {
  const restricted = restriction === 'donor_restricted'
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        restricted ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {restricted ? 'Restricted' : 'Unrestricted'}
    </span>
  )
}

export default async function ContributionsPage() {
  const supabase = await createClient()

  // Separate queries + Map lookups keep the typing clean
  const [contributionsRes, contactsRes, lettersRes] = await Promise.all([
    supabase
      .from('bio_contributions')
      .select('*')
      .order('received_date', { ascending: false }),
    supabase.from('bio_contacts').select('id, display_name'),
    supabase.from('bio_acknowledgement_letters').select('contribution_id, status'),
  ])

  // Casts needed: hand-written interface row types resolve to `never` with supabase-js
  const contributions = (contributionsRes.data ?? []) as unknown as Contribution[]
  const contacts = (contactsRes.data ?? []) as unknown as { id: string; display_name: string }[]
  const letters = (lettersRes.data ?? []) as unknown as {
    contribution_id: string
    status: LetterStatus
  }[]

  const contactNameById = new Map<string, string>(contacts.map((c) => [c.id, c.display_name]))
  const letterStatusByContribution = new Map<string, LetterStatus>(
    letters.map((l) => [l.contribution_id, l.status])
  )

  const currentYear = new Date().getFullYear()
  const ytd = contributions.filter(
    (c) => c.received_date.startsWith(`${currentYear}-`) && c.method !== 'in_kind'
  )
  const ytdCashCents = ytd.reduce((sum, c) => sum + (c.amount_cents ?? 0), 0)

  return (
    <div>
      <PageHeader
        title="Contributions"
        description="Donations received and acknowledgement letters"
        action={{ href: '/contributions/new', label: 'Record contribution' }}
      />

      <div className="card p-5 mb-6 flex items-baseline gap-3">
        <span className="text-2xl font-semibold text-gray-900 tabular-nums">
          {formatCents(ytdCashCents)}
        </span>
        <span className="text-sm text-gray-500">
          cash contributions in {currentYear} ({ytd.length} gift{ytd.length === 1 ? '' : 's'})
        </span>
      </div>

      {contributions.length === 0 ? (
        <EmptyState message="No contributions recorded yet." />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Donor</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 font-medium">Restriction</th>
                <th className="px-4 py-3 font-medium">Letter</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {contributions.map((c) => {
                const letterStatus = letterStatusByContribution.get(c.id)
                return (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{formatDate(c.received_date)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/contacts/${c.contact_id}`}
                        className="font-medium text-gray-900 hover:underline"
                      >
                        {contactNameById.get(c.contact_id) ?? 'Unknown'}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                      {c.method === 'in_kind' ? 'In-kind' : formatCents(c.amount_cents)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{METHOD_LABELS[c.method]}</td>
                    <td className="px-4 py-3">
                      <RestrictionBadge restriction={c.restriction} />
                    </td>
                    <td className="px-4 py-3">
                      {letterStatus ? (
                        <StatusBadge status={letterStatus} />
                      ) : (
                        <span className="text-xs text-gray-400">none</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/contributions/${c.id}`}
                        className="text-xs text-gray-500 hover:text-gray-900 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
