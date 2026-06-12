import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import SubmitButton from '@/components/SubmitButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import { updateGrantIn, addDeliverable } from '@/lib/actions/grants-in'
import { formatDate, daysUntil } from '@/lib/utils/dates'
import type { DeliverableType } from '@/lib/supabase/types/database'
import GrantInFormFields from '../GrantInFormFields'
import DeliverableActions from './DeliverableActions'

const DELIVERABLE_TYPE_LABELS: Record<DeliverableType, string> = {
  narrative_report: 'Narrative report',
  financial_report: 'Financial report',
  invoice: 'Invoice',
  other: 'Other',
}

export default async function GrantInDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: grant } = await supabase
    .from('bio_grants_in')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!grant) notFound()

  const [fundersRes, membersRes, deliverablesRes, attachmentsRes] = await Promise.all([
    supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('is_funder', true)
      .order('display_name'),
    supabase
      .from('bio_team_members')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name'),
    supabase
      .from('bio_grants_in_deliverables')
      .select('*')
      .eq('grant_in_id', id)
      .order('due_date'),
    supabase
      .from('bio_attachments')
      .select('*')
      .eq('entity_type', 'grant_in')
      .eq('entity_id', id)
      .order('created_at', { ascending: false }),
  ])

  let funders = fundersRes.data ?? []
  if (funders.length === 0) {
    const { data: allContacts } = await supabase
      .from('bio_contacts')
      .select('id, display_name')
      .order('display_name')
    funders = allContacts ?? []
  }
  // Ensure the current funder is selectable even if no longer flagged is_funder
  if (!funders.some((f) => f.id === grant.funder_contact_id)) {
    const { data: currentFunder } = await supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('id', grant.funder_contact_id)
      .maybeSingle()
    if (currentFunder) funders = [currentFunder, ...funders]
  }

  const deliverables = deliverablesRes.data ?? []
  const funderDisplayName =
    funders.find((f) => f.id === grant.funder_contact_id)?.display_name ?? 'Unknown funder'

  return (
    <div>
      <PageHeader title={grant.opportunity_name} description={funderDisplayName}>
        <StatusBadge status={grant.status} />
      </PageHeader>

      <div className="space-y-6 max-w-4xl">
        <form action={updateGrantIn.bind(null, grant.id)} className="card p-6">
          <h2 className="font-medium text-gray-900 mb-4">Application details</h2>
          <GrantInFormFields
            funders={funders}
            members={membersRes.data ?? []}
            grant={grant}
          />
          <div className="mt-6">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </form>

        <div className="card p-6">
          <h2 className="font-medium text-gray-900 mb-4">Deliverables</h2>

          {deliverables.length === 0 ? (
            <p className="text-sm text-gray-400 mb-4">No deliverables yet.</p>
          ) : (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">Title</th>
                    <th className="py-2 pr-4 font-medium">Type</th>
                    <th className="py-2 pr-4 font-medium">Due date</th>
                    <th className="py-2 pr-4 font-medium">Submitted</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {deliverables.map((deliverable) => {
                    const overdue =
                      deliverable.status !== 'submitted' && daysUntil(deliverable.due_date) < 0
                    return (
                      <tr
                        key={deliverable.id}
                        className="border-b border-gray-50 hover:bg-gray-50"
                      >
                        <td className="py-2.5 pr-4 font-medium text-gray-900">
                          {deliverable.title}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">
                          {DELIVERABLE_TYPE_LABELS[deliverable.deliverable_type]}
                        </td>
                        <td
                          className={`py-2.5 pr-4 ${overdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}
                        >
                          {formatDate(deliverable.due_date)}
                        </td>
                        <td className="py-2.5 pr-4 text-gray-600">
                          {formatDate(deliverable.submitted_date)}
                        </td>
                        <td className="py-2.5 pr-4">
                          <StatusBadge status={deliverable.status} />
                        </td>
                        <td className="py-2.5 text-right">
                          {deliverable.status !== 'submitted' && (
                            <DeliverableActions
                              deliverableId={deliverable.id}
                              grantInId={grant.id}
                            />
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          <form
            action={addDeliverable.bind(null, grant.id)}
            className="border-t border-gray-100 pt-4"
          >
            <h3 className="text-sm font-medium text-gray-700 mb-3">Add deliverable</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
                <input
                  type="text"
                  name="title"
                  required
                  className="input"
                  placeholder="e.g. Q2 progress report"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select name="deliverable_type" defaultValue="narrative_report" className="input">
                  {(Object.keys(DELIVERABLE_TYPE_LABELS) as DeliverableType[]).map((type) => (
                    <option key={type} value={type}>
                      {DELIVERABLE_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Due date *</label>
                <input type="date" name="due_date" required className="input" />
              </div>
            </div>
            <div className="mt-4">
              <SubmitButton className="btn btn-secondary" pendingLabel="Adding…">
                Add deliverable
              </SubmitButton>
            </div>
          </form>
        </div>

        <AttachmentsPanel
          entityType="grant_in"
          entityId={grant.id}
          attachments={attachmentsRes.data ?? []}
          revalidatePath={`/grants-in/${grant.id}`}
        />
      </div>
    </div>
  )
}
