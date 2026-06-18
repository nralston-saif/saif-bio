import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import type { GrantProposal, Vote } from '@/lib/supabase/types/database'

type VoteTally = { yes: number; no: number; maybe: number }

function tallyLabel(tally: VoteTally | undefined): string {
  if (!tally) return '—'
  const parts: string[] = []
  if (tally.yes > 0) parts.push(`${tally.yes} yes`)
  if (tally.maybe > 0) parts.push(`${tally.maybe} maybe`)
  if (tally.no > 0) parts.push(`${tally.no} no`)
  return parts.length > 0 ? parts.join(' · ') : '—'
}

function ProposalSection({
  title,
  proposals,
  contactNames,
  tallies,
}: {
  title: string
  proposals: GrantProposal[]
  contactNames: Map<string, string>
  tallies: Map<string, VoteTally>
}) {
  return (
    <section>
      <h2 className="text-sm font-medium text-gray-700 mb-2">{title}</h2>
      {proposals.length === 0 ? (
        <div className="card p-6 text-center text-gray-400 text-sm">No proposals.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Applicant</th>
                <th className="px-4 py-3 font-medium text-right">Requested</th>
                <th className="px-4 py-3 font-medium">Received</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Votes</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/grants-out/proposals/${p.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {contactNames.get(p.applicant_contact_id) ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {formatCents(p.amount_requested_cents)}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(p.received_date)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusBadge status={p.status} />
                      {p.decision && <StatusBadge status={p.decision} />}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{tallyLabel(tallies.get(p.id))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

async function ProposalsTab() {
  const supabase = await createClient()
  const [{ data: proposals }, { data: reviews }, { data: contacts }] = await Promise.all([
    supabase
      .from('bio_grant_proposals')
      .select('*')
      .order('received_date', { ascending: false }),
    supabase.from('bio_proposal_reviews').select('proposal_id, vote, recused'),
    supabase.from('bio_contacts').select('id, display_name'),
  ])

  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.display_name]))

  const tallies = new Map<string, VoteTally>()
  for (const review of reviews ?? []) {
    const vote: Vote | null = review.vote
    if (review.recused || !vote) continue
    const tally = tallies.get(review.proposal_id) ?? { yes: 0, no: 0, maybe: 0 }
    tally[vote] += 1
    tallies.set(review.proposal_id, tally)
  }

  const all = proposals ?? []
  if (all.length === 0) {
    return <EmptyState message="No grant proposals yet. Create one to get started." />
  }

  const received = all.filter((p) => p.status === 'received')
  const inReview = all.filter((p) => p.status === 'in_review')
  const closed = all.filter((p) => p.status === 'decided' || p.status === 'withdrawn')

  return (
    <div className="space-y-8">
      <ProposalSection
        title="Received"
        proposals={received}
        contactNames={contactNames}
        tallies={tallies}
      />
      <ProposalSection
        title="In review"
        proposals={inReview}
        contactNames={contactNames}
        tallies={tallies}
      />
      <ProposalSection
        title="Decided / Withdrawn"
        proposals={closed}
        contactNames={contactNames}
        tallies={tallies}
      />
    </div>
  )
}

async function AwardsTab() {
  const supabase = await createClient()
  const [{ data: awards }, { data: disbursements }, { data: contacts }] = await Promise.all([
    supabase.from('bio_grants_out').select('*').order('award_date', { ascending: false }),
    supabase.from('bio_disbursements').select('grant_out_id, amount_cents, status'),
    supabase.from('bio_contacts').select('id, display_name'),
  ])

  const contactNames = new Map((contacts ?? []).map((c) => [c.id, c.display_name]))

  const paidByAward = new Map<string, number>()
  for (const d of disbursements ?? []) {
    if (d.status !== 'paid') continue
    paidByAward.set(d.grant_out_id, (paidByAward.get(d.grant_out_id) ?? 0) + d.amount_cents)
  }

  if (!awards || awards.length === 0) {
    return <EmptyState message="No awards yet. Approve a proposal or record an award directly." />
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
            <th className="px-4 py-3 font-medium">Grantee</th>
            <th className="px-4 py-3 font-medium">Purpose</th>
            <th className="px-4 py-3 font-medium text-right">Awarded</th>
            <th className="px-4 py-3 font-medium">Award date</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium text-right">Disbursed</th>
          </tr>
        </thead>
        <tbody>
          {awards.map((a) => (
            <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50">
              <td className="px-4 py-3">
                <Link
                  href={`/grants-out/awards/${a.id}`}
                  className="font-medium text-gray-900 hover:underline"
                >
                  {contactNames.get(a.grantee_contact_id) ?? 'Unknown grantee'}
                </Link>
              </td>
              <td className="px-4 py-3 text-gray-600">{a.purpose ?? '—'}</td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatCents(a.amount_awarded_cents)}
              </td>
              <td className="px-4 py-3 text-gray-600">{formatDate(a.award_date)}</td>
              <td className="px-4 py-3">
                <StatusBadge status={a.status} />
              </td>
              <td className="px-4 py-3 text-right tabular-nums">
                {formatCents(paidByAward.get(a.id) ?? 0)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default async function GrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab: 'proposals' | 'awards' = tab === 'awards' ? 'awards' : 'proposals'

  const tabs = [
    { key: 'proposals' as const, label: 'Proposals', href: '/grants-out?tab=proposals' },
    { key: 'awards' as const, label: 'Awards', href: '/grants-out?tab=awards' },
  ]

  return (
    <div>
      <PageHeader
        title="Grants"
        description="Proposals received and grants awarded by SAIFbio."
        action={{ href: '/grants-out/new', label: 'New proposal' }}
      >
        <Link href="/grants-out/awards/new" className="btn btn-secondary">
          Record award directly
        </Link>
      </PageHeader>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === 'proposals' ? <ProposalsTab /> : <AwardsTab />}
    </div>
  )
}
