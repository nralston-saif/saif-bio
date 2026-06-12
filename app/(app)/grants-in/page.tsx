import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import { formatCents } from '@/lib/utils/money'
import { formatDate, daysUntil } from '@/lib/utils/dates'
import type { GrantInStatus } from '@/lib/supabase/types/database'

const STATUS_ORDER: GrantInStatus[] = [
  'prospect',
  'preparing',
  'submitted',
  'awarded',
  'declined',
  'withdrawn',
]

const OPEN_STATUSES = new Set<GrantInStatus>(['prospect', 'preparing', 'submitted'])

export default async function GrantsInPage() {
  const supabase = await createClient()

  const [grantsRes, contactsRes, membersRes] = await Promise.all([
    supabase
      .from('bio_grants_in')
      .select('*')
      .order('application_deadline', { ascending: true, nullsFirst: false }),
    supabase.from('bio_contacts').select('id, display_name'),
    supabase.from('bio_team_members').select('id, full_name'),
  ])

  const grants = grantsRes.data ?? []
  const funderName = new Map((contactsRes.data ?? []).map((c) => [c.id, c.display_name]))
  const ownerName = new Map((membersRes.data ?? []).map((m) => [m.id, m.full_name]))

  const groups = STATUS_ORDER.map((status) => ({
    status,
    rows: grants.filter((g) => g.status === status),
  })).filter((group) => group.rows.length > 0)

  return (
    <div>
      <PageHeader
        title="Grants in"
        description="Funding applications SAIF Bio is pursuing"
        action={{ href: '/grants-in/new', label: 'New application' }}
      />

      {groups.length === 0 ? (
        <EmptyState message="No grant applications yet. Start by adding a new application." />
      ) : (
        <div className="space-y-6">
          {groups.map(({ status, rows }) => (
            <div key={status} className="card overflow-hidden">
              <div className="flex items-center gap-2 px-5 pt-4 pb-2">
                <h2 className="font-medium text-gray-900 capitalize">
                  {status.replace(/_/g, ' ')}
                </h2>
                <span className="text-xs text-gray-400">{rows.length}</span>
              </div>
              <div className="px-5 pb-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                      <th className="py-2 pr-4 font-medium">Opportunity</th>
                      <th className="py-2 pr-4 font-medium">Funder</th>
                      <th className="py-2 pr-4 font-medium text-right">Requested</th>
                      <th className="py-2 pr-4 font-medium text-right">Awarded</th>
                      <th className="py-2 pr-4 font-medium">Deadline</th>
                      <th className="py-2 pr-4 font-medium">Owner</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((grant) => {
                      const urgent =
                        grant.application_deadline !== null &&
                        OPEN_STATUSES.has(grant.status) &&
                        daysUntil(grant.application_deadline) < 14
                      return (
                        <tr key={grant.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2.5 pr-4">
                            <Link
                              href={`/grants-in/${grant.id}`}
                              className="font-medium text-gray-900 hover:underline"
                            >
                              {grant.opportunity_name}
                            </Link>
                            {grant.program && (
                              <span className="block text-xs text-gray-400">{grant.program}</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">
                            {funderName.get(grant.funder_contact_id) ?? '—'}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatCents(grant.amount_requested_cents)}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums">
                            {formatCents(grant.amount_awarded_cents)}
                          </td>
                          <td
                            className={`py-2.5 pr-4 ${urgent ? 'text-red-600 font-medium' : 'text-gray-600'}`}
                          >
                            {formatDate(grant.application_deadline)}
                          </td>
                          <td className="py-2.5 pr-4 text-gray-600">
                            {grant.owner_id ? (ownerName.get(grant.owner_id) ?? '—') : '—'}
                          </td>
                          <td className="py-2.5">
                            <StatusBadge status={grant.status} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
