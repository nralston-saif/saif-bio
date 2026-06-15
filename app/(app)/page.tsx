import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import { formatCents } from '@/lib/utils/money'
import { formatDate, daysUntil } from '@/lib/utils/dates'
import { currentFiscalYear, fiscalYearRange } from '@/lib/utils/fiscal-year'

interface AgendaItem {
  key: string
  label: string
  detail: string
  date: string
  href: string
}

/** ISO date string `days` days from today, local time */
function isoDaysFromNow(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function DaysChip({ date }: { date: string }) {
  const days = daysUntil(date)
  const overdue = days < 0
  const label = overdue ? `${-days}d overdue` : days === 0 ? 'today' : `in ${days}d`
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
        overdue ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {label}
    </span>
  )
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: settings } = await supabase
    .from('bio_settings')
    .select('fiscal_year_start_month')
    .eq('id', 1)
    .maybeSingle()

  const startMonth = settings?.fiscal_year_start_month ?? 1
  const fy = currentFiscalYear(startMonth)
  const { start, end } = fiscalYearRange(fy, startMonth)
  const horizon = isoDaysFromNow(30)

  const [
    memberRes,
    fyContributionsRes,
    fyExpensesRes,
    fyDisbursementsRes,
    activeGrantsRes,
    proposalsRes,
    reviewsRes,
    recentContributionsRes,
    recentExpensesRes,
    scheduledDisbursementsRes,
    granteeReportsRes,
  ] = await Promise.all([
    supabase
      .from('bio_team_members')
      .select('id')
      .eq('auth_user_id', user?.id ?? '')
      .maybeSingle(),
    supabase
      .from('bio_contributions')
      .select('amount_cents, method')
      .gte('received_date', start)
      .lt('received_date', end),
    supabase
      .from('bio_expenses')
      .select('amount_cents')
      .gte('expense_date', start)
      .lt('expense_date', end),
    supabase
      .from('bio_disbursements')
      .select('amount_cents')
      .eq('status', 'paid')
      .gte('paid_date', start)
      .lt('paid_date', end),
    supabase
      .from('bio_grants_out')
      .select('id', { count: 'exact', head: true })
      .in('status', ['awarded', 'active']),
    supabase
      .from('bio_grant_proposals')
      .select('id, title')
      .in('status', ['received', 'in_review'])
      .order('created_at'),
    supabase.from('bio_proposal_reviews').select('proposal_id, reviewer_id'),
    supabase
      .from('bio_contributions')
      .select('id, contact_id, amount_cents, received_date')
      .order('received_date', { ascending: false })
      .limit(5),
    supabase
      .from('bio_expenses')
      .select('id, description, amount_cents, expense_date')
      .order('expense_date', { ascending: false })
      .limit(5),
    supabase
      .from('bio_disbursements')
      .select('id, grant_out_id, amount_cents, scheduled_date')
      .eq('status', 'scheduled')
      .not('scheduled_date', 'is', null)
      .lte('scheduled_date', horizon),
    supabase
      .from('bio_grantee_reports')
      .select('id, grant_out_id, report_type, due_date')
      .in('status', ['upcoming', 'overdue'])
      .lte('due_date', horizon),
  ])

  const memberId = memberRes.data?.id ?? null

  // Stat card totals
  const fyContributionsTotal = (fyContributionsRes.data ?? [])
    .filter((c) => c.method !== 'in_kind' && c.amount_cents !== null)
    .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0)
  const fyExpensesTotal = (fyExpensesRes.data ?? []).reduce((sum, e) => sum + e.amount_cents, 0)
  const fyGrantsPaidTotal = (fyDisbursementsRes.data ?? []).reduce(
    (sum, d) => sum + d.amount_cents,
    0
  )
  const activeGrantsCount = activeGrantsRes.count ?? 0

  // Proposals awaiting this member's review
  const reviews = reviewsRes.data ?? []
  const needsVote = (proposalsRes.data ?? []).filter(
    (p) =>
      memberId !== null &&
      !reviews.some((r) => r.proposal_id === p.id && r.reviewer_id === memberId)
  )

  // Second wave: lookups for agenda items and recent activity
  const scheduledDisbursements = scheduledDisbursementsRes.data ?? []
  const granteeReports = granteeReportsRes.data ?? []
  const recentContributions = recentContributionsRes.data ?? []

  const grantOutIds = Array.from(
    new Set([
      ...scheduledDisbursements.map((d) => d.grant_out_id),
      ...granteeReports.map((r) => r.grant_out_id),
    ])
  )

  const grantsOutRes =
    grantOutIds.length > 0
      ? await supabase.from('bio_grants_out').select('id, grantee_contact_id').in('id', grantOutIds)
      : { data: [] as { id: string; grantee_contact_id: string }[] }

  const grantsOut = grantsOutRes.data ?? []
  const contactIds = Array.from(
    new Set([
      ...grantsOut.map((g) => g.grantee_contact_id),
      ...recentContributions.map((c) => c.contact_id),
    ])
  )

  const { data: contacts } =
    contactIds.length > 0
      ? await supabase.from('bio_contacts').select('id, display_name').in('id', contactIds)
      : { data: [] as { id: string; display_name: string }[] }

  const contactName = new Map((contacts ?? []).map((c) => [c.id, c.display_name]))
  const granteeNameByGrantOut = new Map(
    grantsOut.map((g) => [g.id, contactName.get(g.grantee_contact_id) ?? 'Unknown grantee'])
  )

  const agenda: AgendaItem[] = [
    ...scheduledDisbursements
      .filter((d): d is typeof d & { scheduled_date: string } => d.scheduled_date !== null)
      .map((d) => ({
        key: `disbursement-${d.id}`,
        label: `Disbursement · ${formatCents(d.amount_cents)}`,
        detail: granteeNameByGrantOut.get(d.grant_out_id) ?? 'Unknown grantee',
        date: d.scheduled_date,
        href: `/grants-out/awards/${d.grant_out_id}`,
      })),
    ...granteeReports.map((r) => ({
      key: `report-${r.id}`,
      label: `Grantee ${r.report_type} report due`,
      detail: granteeNameByGrantOut.get(r.grant_out_id) ?? 'Unknown grantee',
      date: r.due_date,
      href: `/grants-out/awards/${r.grant_out_id}`,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const stats = [
    { label: `FY${fy} contributions`, value: formatCents(fyContributionsTotal) },
    { label: `FY${fy} expenses`, value: formatCents(fyExpensesTotal) },
    { label: `FY${fy} grants paid`, value: formatCents(fyGrantsPaidTotal) },
    { label: 'Active grants', value: String(activeGrantsCount) },
  ]

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`Fiscal year ${fy} · ${formatDate(start)} onward`}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {stats.map((stat) => (
          <div key={stat.label} className="card p-5">
            <p className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</p>
            <p className="text-2xl font-semibold text-gray-900 tabular-nums mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="font-medium text-gray-900 mb-3">Needs your vote</h2>
          {needsVote.length === 0 ? (
            <p className="text-sm text-gray-400">No proposals waiting on your review.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {needsVote.map((proposal) => (
                <li key={proposal.id} className="py-2.5">
                  <Link
                    href={`/grants-out/proposals/${proposal.id}`}
                    className="text-sm font-medium text-gray-900 hover:underline"
                  >
                    {proposal.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-medium text-gray-900 mb-3">Upcoming &amp; overdue</h2>
          {agenda.length === 0 ? (
            <p className="text-sm text-gray-400">Nothing due in the next 30 days.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {agenda.map((item) => (
                <li key={item.key} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={item.href}
                      className="block text-sm font-medium text-gray-900 hover:underline truncate"
                    >
                      {item.label}
                    </Link>
                    <span className="block text-xs text-gray-400 truncate">{item.detail}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-gray-500">{formatDate(item.date)}</span>
                    <DaysChip date={item.date} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-medium text-gray-900 mb-3">Recent contributions</h2>
          {recentContributions.length === 0 ? (
            <p className="text-sm text-gray-400">No contributions yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {recentContributions.map((c) => (
                <li key={c.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-900 truncate">
                    {contactName.get(c.contact_id) ?? 'Unknown donor'}
                  </span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-500 text-xs">{formatDate(c.received_date)}</span>
                    <span className="tabular-nums font-medium">
                      {formatCents(c.amount_cents)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="font-medium text-gray-900 mb-3">Recent expenses</h2>
          {(recentExpensesRes.data ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">No expenses yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {(recentExpensesRes.data ?? []).map((e) => (
                <li key={e.id} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-900 truncate">{e.description}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-gray-500 text-xs">{formatDate(e.expense_date)}</span>
                    <span className="tabular-nums font-medium">{formatCents(e.amount_cents)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
