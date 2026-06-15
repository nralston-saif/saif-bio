import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import SubmitButton from '@/components/SubmitButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import { updateContact } from '@/lib/actions/contacts'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import type {
  Attachment,
  Contact,
  Contribution,
  GrantOut,
  LetterStatus,
} from '@/lib/supabase/types/database'
import { METHOD_LABELS } from '../../contributions/methods'
import ContactFormFields from '../ContactFormFields'

export default async function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contactRow } = await supabase
    .from('bio_contacts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // Casts needed: hand-written interface row types resolve to `never` with supabase-js
  const contact = contactRow as unknown as Contact | null
  if (!contact) notFound()

  const [contributionsRes, grantsOutRes, attachmentsRes] = await Promise.all([
    supabase
      .from('bio_contributions')
      .select('*')
      .eq('contact_id', id)
      .order('received_date', { ascending: false }),
    supabase
      .from('bio_grants_out')
      .select('*')
      .eq('grantee_contact_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('bio_attachments')
      .select('*')
      .eq('entity_type', 'contact')
      .eq('entity_id', id)
      .order('created_at', { ascending: false }),
  ])

  const contributions = (contributionsRes.data ?? []) as unknown as Contribution[]
  const grantsOut = (grantsOutRes.data ?? []) as unknown as GrantOut[]
  const attachments = (attachmentsRes.data ?? []) as unknown as Attachment[]

  // Letter statuses for this contact's contributions
  const letterStatusByContribution = new Map<string, LetterStatus>()
  const contributionIds = contributions.map((c) => c.id)
  if (contributionIds.length > 0) {
    const { data } = await supabase
      .from('bio_acknowledgement_letters')
      .select('contribution_id, status')
      .in('contribution_id', contributionIds)
    const letters = (data ?? []) as unknown as { contribution_id: string; status: LetterStatus }[]
    for (const letter of letters) {
      letterStatusByContribution.set(letter.contribution_id, letter.status)
    }
  }

  return (
    <div>
      <PageHeader
        title={contact.display_name}
        description={contact.contact_type === 'organization' ? 'Organization' : 'Individual'}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <form action={updateContact.bind(null, contact.id)} className="card p-6">
            <h2 className="font-medium text-gray-900 mb-4">Details</h2>
            <ContactFormFields contact={contact} />
            <div className="mt-6 flex justify-end">
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </form>

          {contributions.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="font-medium text-gray-900 px-4 pt-4 pb-2">Contributions</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium">Method</th>
                    <th className="px-4 py-2 font-medium">Letter</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((c) => {
                    const letterStatus = letterStatusByContribution.get(c.id)
                    return (
                      <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-600">{formatDate(c.received_date)}</td>
                        <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                          {c.method === 'in_kind' ? 'In-kind' : formatCents(c.amount_cents)}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{METHOD_LABELS[c.method]}</td>
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

          {grantsOut.length > 0 && (
            <div className="card overflow-x-auto">
              <h2 className="font-medium text-gray-900 px-4 pt-4 pb-2">Grants awarded to this contact</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                    <th className="px-4 py-2 font-medium">Award date</th>
                    <th className="px-4 py-2 font-medium">Purpose</th>
                    <th className="px-4 py-2 font-medium text-right">Amount</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {grantsOut.map((g) => (
                    <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-600">{formatDate(g.award_date)}</td>
                      <td className="px-4 py-3 text-gray-600">{g.purpose ?? '—'}</td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-900">
                        {formatCents(g.amount_awarded_cents)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={g.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>

        <div className="space-y-6">
          <AttachmentsPanel
            entityType="contact"
            entityId={contact.id}
            attachments={attachments}
            revalidatePath={`/contacts/${contact.id}`}
          />
        </div>
      </div>
    </div>
  )
}
