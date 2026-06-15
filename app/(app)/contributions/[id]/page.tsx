import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import type {
  AcknowledgementLetter,
  Attachment,
  Contact,
  Contribution,
  StockContributionDetail,
} from '@/lib/supabase/types/database'
import { METHOD_LABELS } from '../methods'
import ContributionForm from '../new/ContributionForm'
import LetterPanel from './LetterPanel'

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-gray-50 last:border-0">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 text-right">{children}</dd>
    </div>
  )
}

function formatShares(shares: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 6,
  }).format(shares)
}

export default async function ContributionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: contributionRow } = await supabase
    .from('bio_contributions')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // Casts needed: hand-written interface row types resolve to `never` with supabase-js
  const contribution = contributionRow as unknown as Contribution | null
  if (!contribution) notFound()

  const [contactRes, letterRes, attachmentsRes, contactsRes, stockDetailRes] = await Promise.all([
      supabase
        .from('bio_contacts')
        .select('*')
        .eq('id', contribution.contact_id)
        .maybeSingle(),
      supabase
        .from('bio_acknowledgement_letters')
        .select('*')
        .eq('contribution_id', id)
        .maybeSingle(),
      supabase
        .from('bio_attachments')
        .select('*')
        .eq('entity_type', 'contribution')
        .eq('entity_id', id)
        .order('created_at', { ascending: false }),
      supabase.from('bio_contacts').select('id, display_name').order('display_name'),
      supabase
        .from('bio_stock_contribution_details')
        .select('*')
        .eq('contribution_id', id)
        .maybeSingle(),
    ])

  const contact = contactRes.data as unknown as Contact | null
  const letter = letterRes.data as unknown as AcknowledgementLetter | null
  const attachments = (attachmentsRes.data ?? []) as unknown as Attachment[]
  const contacts = (contactsRes.data ?? []) as unknown as { id: string; display_name: string }[]
  const stockDetail = stockDetailRes.data as unknown as StockContributionDetail | null

  const letterSent = letter?.status === 'sent'

  return (
    <div>
      <PageHeader
        title={`Contribution from ${contact?.display_name ?? 'Unknown donor'}`}
        description={`Received ${formatDate(contribution.received_date)}`}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h2 className="font-medium text-gray-900 mb-3">Details</h2>
            <dl>
              <DetailRow label="Donor">
                {contact ? (
                  <Link href={`/contacts/${contact.id}`} className="hover:underline">
                    {contact.display_name}
                  </Link>
                ) : (
                  '—'
                )}
              </DetailRow>
              <DetailRow label="Amount">
                <span className="tabular-nums">
                  {contribution.method === 'in_kind' && contribution.amount_cents === null
                    ? 'In-kind'
                    : formatCents(contribution.amount_cents)}
                </span>
              </DetailRow>
              <DetailRow label="Received date">{formatDate(contribution.received_date)}</DetailRow>
              <DetailRow label="Method">{METHOD_LABELS[contribution.method]}</DetailRow>
              {contribution.method === 'in_kind' && (
                <DetailRow label="In-kind description">
                  {contribution.in_kind_description ?? '—'}
                </DetailRow>
              )}
              {contribution.method === 'stock' && stockDetail && (
                <>
                  <DetailRow label="Security">{stockDetail.security_name}</DetailRow>
                  <DetailRow label="Ticker">{stockDetail.ticker_symbol ?? '—'}</DetailRow>
                  <DetailRow label="Shares">{formatShares(stockDetail.shares)}</DetailRow>
                  <DetailRow label="Valuation date">
                    {formatDate(stockDetail.valuation_date)}
                  </DetailRow>
                  <DetailRow label="FMV per share">
                    <span className="tabular-nums">
                      {formatCents(stockDetail.fmv_per_share_cents)}
                    </span>
                  </DetailRow>
                  <DetailRow label="Valuation source">
                    {stockDetail.valuation_source.replace(/_/g, ' ')}
                  </DetailRow>
                  {stockDetail.market_price_source && (
                    <DetailRow label="Market data source">
                      {stockDetail.market_price_source.toUpperCase()}
                    </DetailRow>
                  )}
                  {stockDetail.sale_date && (
                    <>
                      <DetailRow label="Sale date">{formatDate(stockDetail.sale_date)}</DetailRow>
                      <DetailRow label="Net sale proceeds">
                        <span className="tabular-nums">
                          {formatCents(stockDetail.sale_net_cents)}
                        </span>
                      </DetailRow>
                    </>
                  )}
                </>
              )}
              <DetailRow label="Restriction">
                {contribution.restriction === 'donor_restricted' ? 'Donor restricted' : 'Unrestricted'}
              </DetailRow>
              {contribution.restriction_purpose && (
                <DetailRow label="Restriction purpose">
                  {contribution.restriction_purpose}
                </DetailRow>
              )}
              {contribution.quid_pro_quo && (
                <>
                  <DetailRow label="Goods/services provided">
                    {contribution.goods_services_description ?? '—'}
                  </DetailRow>
                  <DetailRow label="Goods/services value">
                    <span className="tabular-nums">
                      {formatCents(contribution.goods_services_value_cents)}
                    </span>
                  </DetailRow>
                </>
              )}
              {contribution.check_number && (
                <DetailRow label="Check number">{contribution.check_number}</DetailRow>
              )}
              {contribution.notes && <DetailRow label="Notes">{contribution.notes}</DetailRow>}
            </dl>
          </div>

          {letterSent ? (
            <div className="card p-5 text-sm text-gray-500">
              Locked — the acknowledgement letter has been sent, so this contribution can no
              longer be edited.
            </div>
          ) : (
            <div>
              <h2 className="font-medium text-gray-900 mb-3">Edit contribution</h2>
              <ContributionForm
                contacts={contacts}
                contribution={contribution}
                stockDetail={stockDetail}
              />
            </div>
          )}
        </div>

        <div className="space-y-6">
          <LetterPanel
            contributionId={contribution.id}
            letter={
              letter
                ? {
                    status: letter.status,
                    sent_at: letter.sent_at,
                    sent_to_email: letter.sent_to_email,
                  }
                : null
            }
            hasEmail={Boolean(contact?.email)}
          />
          <AttachmentsPanel
            entityType="contribution"
            entityId={contribution.id}
            attachments={attachments}
            revalidatePath={`/contributions/${contribution.id}`}
          />
        </div>
      </div>
    </div>
  )
}
