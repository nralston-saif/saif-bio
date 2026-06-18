'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode } from '@/lib/supabase/demo/mock-client'
import { requireMemberId, ActionError } from './helpers'
import { buildLetterData, type LetterData } from '@/lib/pdf/letter-data'
import { todayISO } from '@/lib/utils/dates'
import { getResend } from '@/lib/email/resend'

// Signatory e-signature lives in the private `letters` bucket — never in git —
// so it is embedded at render time and survives deleting any local copy.
const SIGNATURE_STORAGE_PATH = 'assets/signature.jpeg'

/** The signatory's e-signature as a base64 data URI, or null if not uploaded. */
async function getSignatureDataUri(): Promise<string | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.storage.from('letters').download(SIGNATURE_STORAGE_PATH)
    if (error || !data) return null
    const buf = Buffer.from(await data.arrayBuffer())
    return `data:image/jpeg;base64,${buf.toString('base64')}`
  } catch {
    return null
  }
}

async function renderLetterPdf(data: LetterData, signature: string | null): Promise<Buffer> {
  // Dynamic imports keep @react-pdf/renderer out of shared bundles
  const { renderToBuffer } = await import('@react-pdf/renderer')
  const { default: AcknowledgementLetter } = await import('@/lib/pdf/AcknowledgementLetter')
  const { createElement } = await import('react')
  const element = createElement(AcknowledgementLetter, { data, signature })
  // renderToBuffer's signature expects a <Document> element; ours is a
  // component that renders one, which works at runtime
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0])
}

async function loadLetterInputs(contributionId: string) {
  const supabase = await createClient()

  const { data: contribution, error } = await supabase
    .from('bio_contributions')
    .select('*')
    .eq('id', contributionId)
    .single()
  if (error || !contribution) throw new ActionError('Contribution not found')

  const { data: contact } = await supabase
    .from('bio_contacts')
    .select('*')
    .eq('id', contribution.contact_id)
    .single()
  if (!contact) throw new ActionError('Contact not found')

  const { data: settings } = await supabase
    .from('bio_settings')
    .select('*')
    .eq('id', 1)
    .single()
  if (!settings) throw new ActionError('Settings not found')

  const { data: stockDetail } =
    contribution.method === 'stock'
      ? await supabase
          .from('bio_stock_contribution_details')
          .select('*')
          .eq('contribution_id', contributionId)
          .maybeSingle()
      : { data: null }

  return { contribution, contact, settings, stockDetail }
}

export async function generateLetter(contributionId: string) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { contribution, contact, settings, stockDetail } = await loadLetterInputs(contributionId)

  let letterData: LetterData
  try {
    letterData = buildLetterData(contribution, contact, settings, todayISO(), stockDetail)
  } catch (err) {
    throw new ActionError(err instanceof Error ? err.message : 'Could not build letter')
  }

  const signature = await getSignatureDataUri()
  const pdf = await renderLetterPdf(letterData, signature)

  const year = contribution.received_date.slice(0, 4)
  const storagePath = `contributions/${contributionId}/acknowledgement-${year}.pdf`

  // Service-role client: letters bucket writes happen server-side only
  const admin = createAdminClient()
  const { error: uploadError } = await admin.storage
    .from('letters')
    .upload(storagePath, pdf, { contentType: 'application/pdf', upsert: true })

  if (uploadError) throw new ActionError(`PDF upload failed: ${uploadError.message}`)

  const { error: upsertError } = await supabase
    .from('bio_acknowledgement_letters')
    .upsert(
      {
        contribution_id: contributionId,
        status: 'generated',
        pdf_storage_path: storagePath,
        body_snapshot: JSON.parse(JSON.stringify(letterData)),
        generated_by: memberId,
      },
      { onConflict: 'contribution_id' }
    )

  if (upsertError) throw new ActionError(upsertError.message)

  revalidatePath(`/contributions/${contributionId}`)
  revalidatePath('/contributions')
}

export async function sendLetter(contributionId: string) {
  await requireMemberId()
  const supabase = await createClient()

  const { data: letter } = await supabase
    .from('bio_acknowledgement_letters')
    .select('*')
    .eq('contribution_id', contributionId)
    .maybeSingle()

  if (!letter || letter.status === 'draft' || !letter.pdf_storage_path) {
    throw new ActionError('Generate the letter before sending')
  }

  const { contact, settings } = await loadLetterInputs(contributionId)
  if (!contact.email) {
    throw new ActionError('This contact has no email address on file')
  }

  const admin = createAdminClient()
  const { data: pdfBlob, error: downloadError } = await admin.storage
    .from('letters')
    .download(letter.pdf_storage_path)

  if (downloadError || !pdfBlob) throw new ActionError('Could not load the generated PDF')

  // Demo mode: record the send without emailing anyone
  if (isDemoMode()) {
    await supabase
      .from('bio_acknowledgement_letters')
      .update({
        status: 'sent',
        sent_to_email: contact.email,
        sent_at: new Date().toISOString(),
        resend_message_id: 'demo-mode-no-email-sent',
      })
      .eq('id', letter.id)
    revalidatePath(`/contributions/${contributionId}`)
    revalidatePath('/contributions')
    return
  }

  const fromEmail = settings.letter_from_email ?? process.env.LETTER_FROM_EMAIL
  if (!fromEmail) {
    throw new ActionError('No from-address configured. Set one in Settings.')
  }

  const resend = getResend()
  const { data: sendResult, error: sendError } = await resend.emails.send({
    from: `${settings.org_legal_name} <${fromEmail}>`,
    to: contact.email,
    subject: `Your contribution acknowledgement from ${settings.org_legal_name}`,
    text:
      `Dear ${contact.display_name},\n\n` +
      `Thank you for your contribution to ${settings.org_legal_name}. ` +
      `Your formal acknowledgement letter is attached. Please retain it for your tax records.\n\n` +
      `Sincerely,\n${settings.letter_signatory_name ?? settings.org_legal_name}`,
    attachments: [
      {
        filename: 'contribution-acknowledgement.pdf',
        content: Buffer.from(await pdfBlob.arrayBuffer()),
      },
    ],
  })

  if (sendError) throw new ActionError(`Email failed: ${sendError.message}`)

  const { error: updateError } = await supabase
    .from('bio_acknowledgement_letters')
    .update({
      status: 'sent',
      sent_to_email: contact.email,
      sent_at: new Date().toISOString(),
      resend_message_id: sendResult?.id ?? null,
    })
    .eq('id', letter.id)

  if (updateError) throw new ActionError(updateError.message)

  revalidatePath(`/contributions/${contributionId}`)
  revalidatePath('/contributions')
}
