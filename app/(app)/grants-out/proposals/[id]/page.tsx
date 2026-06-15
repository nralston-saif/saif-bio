import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { addComment, setProposalStatus } from '@/lib/actions/grants-out'
import { isMemoComplete, memoAnsweredCount } from '@/lib/grants/memo'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import SubmitButton from '@/components/SubmitButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import { formatCents, centsToDollarString } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import MyReviewForm from './MyReviewForm'
import DecisionForm from './DecisionForm'
import MemoCard from './MemoCard'

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso.slice(0, 10))
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-gray-500 uppercase tracking-wide">{label}</dt>
      <dd className="text-sm text-gray-900 mt-0.5">{value}</dd>
    </div>
  )
}

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  const { data: proposal } = await supabase
    .from('bio_grant_proposals')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!proposal) notFound()

  const [
    { data: applicant },
    { data: members },
    { data: reviews },
    { data: comments },
    { data: attachments },
    { data: award },
    { data: memo },
    {
      data: { user },
    },
  ] = await Promise.all([
    supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('id', proposal.applicant_contact_id)
      .maybeSingle(),
    supabase
      .from('bio_team_members')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name'),
    supabase.from('bio_proposal_reviews').select('*').eq('proposal_id', id),
    supabase
      .from('bio_proposal_comments')
      .select('*')
      .eq('proposal_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('bio_attachments')
      .select('*')
      .eq('entity_type', 'grant_proposal')
      .eq('entity_id', id)
      .order('created_at', { ascending: false }),
    supabase.from('bio_grants_out').select('id').eq('proposal_id', id).maybeSingle(),
    supabase.from('bio_proposal_memos').select('*').eq('proposal_id', id).maybeSingle(),
    supabase.auth.getUser(),
  ])

  let currentMemberId: string | null = null
  if (user) {
    const { data: me } = await supabase
      .from('bio_team_members')
      .select('id')
      .eq('auth_user_id', user.id)
      .maybeSingle()
    currentMemberId = me?.id ?? null
  }

  const memberNames = new Map((members ?? []).map((m) => [m.id, m.full_name]))
  const reviewsByMember = new Map((reviews ?? []).map((r) => [r.reviewer_id, r]))
  const myReview = currentMemberId ? (reviewsByMember.get(currentMemberId) ?? null) : null

  const isOpen = proposal.status === 'received' || proposal.status === 'in_review'
  const memoComplete = isMemoComplete(memo)
  const memoAnswered = memoAnsweredCount(memo)
  const memoTotal = 15

  return (
    <div>
      <PageHeader title={proposal.title} description={applicant?.display_name ?? undefined} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Proposal details */}
          <div className="card p-5">
            <h3 className="font-medium text-gray-900 mb-4">Proposal details</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DetailRow
                label="Applicant"
                value={
                  applicant ? (
                    <Link href={`/contacts/${applicant.id}`} className="hover:underline">
                      {applicant.display_name}
                    </Link>
                  ) : (
                    '—'
                  )
                }
              />
              <DetailRow
                label="Amount requested"
                value={
                  <span className="tabular-nums">{formatCents(proposal.amount_requested_cents)}</span>
                }
              />
              <DetailRow label="Program area" value={proposal.program_area ?? '—'} />
              <DetailRow label="Received" value={formatDate(proposal.received_date)} />
              <DetailRow label="Source" value={proposal.source ?? '—'} />
            </dl>
            {proposal.summary && (
              <div className="mt-4">
                <dt className="text-xs text-gray-500 uppercase tracking-wide">Summary</dt>
                <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{proposal.summary}</p>
              </div>
            )}
          </div>

          <MemoCard
            proposalId={proposal.id}
            memo={memo}
            startedByName={memo?.started_by ? (memberNames.get(memo.started_by) ?? null) : null}
            lastEditedByName={
              memo?.last_edited_by ? (memberNames.get(memo.last_edited_by) ?? null) : null
            }
          />

          {/* Discussion */}
          <div className="card p-5">
            <h3 className="font-medium text-gray-900 mb-3">Discussion</h3>
            {(comments ?? []).length === 0 ? (
              <p className="text-sm text-gray-400 mb-4">No comments yet.</p>
            ) : (
              <ul className="space-y-4 mb-4">
                {(comments ?? []).map((comment) => (
                  <li key={comment.id}>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-900">
                        {memberNames.get(comment.author_id) ?? 'Unknown'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {relativeTime(comment.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                      {comment.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form action={addComment.bind(null, proposal.id)} className="space-y-2">
              <textarea
                name="body"
                rows={2}
                required
                placeholder="Add a comment…"
                className="input"
              />
              <SubmitButton pendingLabel="Posting…" className="btn btn-secondary">
                Post comment
              </SubmitButton>
            </form>
          </div>

          <AttachmentsPanel
            entityType="grant_proposal"
            entityId={proposal.id}
            attachments={attachments ?? []}
            revalidatePath={`/grants-out/proposals/${proposal.id}`}
          />
        </div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Status */}
          <div className="card p-5">
            <h3 className="font-medium text-gray-900 mb-3">Status</h3>
            <div className="flex items-center gap-1.5 mb-4">
              <StatusBadge status={proposal.status} />
              {proposal.decision && <StatusBadge status={proposal.decision} />}
            </div>
            <div className="flex flex-col gap-2">
              {proposal.status === 'received' && (
                <form action={setProposalStatus.bind(null, proposal.id, 'in_review' as const)}>
                  <SubmitButton pendingLabel="Starting…" className="btn btn-primary w-full">
                    Start review
                  </SubmitButton>
                </form>
              )}
              {isOpen && (
                <form action={setProposalStatus.bind(null, proposal.id, 'withdrawn' as const)}>
                  <SubmitButton pendingLabel="Withdrawing…" className="btn btn-secondary w-full">
                    Withdraw
                  </SubmitButton>
                </form>
              )}
            </div>
          </div>

          {/* Reviews */}
          <div className="card p-5">
            <h3 className="font-medium text-gray-900 mb-3">Partner reviews</h3>
            <ul className="space-y-3">
              {(members ?? []).map((member) => {
                const review = reviewsByMember.get(member.id)
                return (
                  <li key={member.id}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-900">{member.full_name}</span>
                      <span className="flex items-center gap-2">
                        {review?.recused ? (
                          <span className="text-xs text-gray-400 italic">Recused</span>
                        ) : review?.vote ? (
                          <StatusBadge status={review.vote} />
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                        {!review?.recused && review?.score != null && (
                          <span className="text-xs text-gray-600 tabular-nums">
                            ★ {review.score}/5
                          </span>
                        )}
                      </span>
                    </div>
                    {review?.comments && (
                      <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">
                        {review.comments}
                      </p>
                    )}
                  </li>
                )
              })}
            </ul>
            {currentMemberId && (
              <MyReviewForm
                proposalId={proposal.id}
                existing={
                  myReview
                    ? {
                        score: myReview.score,
                        vote: myReview.vote,
                        comments: myReview.comments,
                        recused: myReview.recused,
                      }
                    : null
                }
              />
            )}
          </div>

          {/* Decision */}
          {proposal.status === 'in_review' && !proposal.decision && (
            <div className="card p-5">
              <h3 className="font-medium text-gray-900 mb-3">Decision</h3>
              {memoComplete ? (
                <DecisionForm
                  proposalId={proposal.id}
                  requestedAmount={centsToDollarString(proposal.amount_requested_cents)}
                />
              ) : (
                <p className="text-sm text-gray-500">
                  The evaluation memo must be fully filled in before a decision can be recorded.
                  <span className="block text-xs text-gray-400 mt-1 tabular-nums">
                    {memoAnswered}/{memoTotal} questions answered
                  </span>
                </p>
              )}
            </div>
          )}
          {proposal.decision && (
            <div className="card p-5">
              <h3 className="font-medium text-gray-900 mb-3">Decision</h3>
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={proposal.decision} />
                <span className="text-sm text-gray-500">{formatDate(proposal.decision_date)}</span>
              </div>
              {proposal.decision_notes && (
                <p className="text-sm text-gray-700 whitespace-pre-wrap mb-2">
                  {proposal.decision_notes}
                </p>
              )}
              {award && (
                <Link
                  href={`/grants-out/awards/${award.id}`}
                  className="text-sm text-gray-900 underline hover:no-underline"
                >
                  View award →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
