import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId } from '@/lib/actions/helpers'
import { extractInvoiceFields, isInvoiceExtractionEnabled } from '@/lib/invoices/extract'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_BYTES = 10 * 1024 * 1024

/** Read an uploaded invoice PDF and return pre-fill fields for the expense form. */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    await requireMemberId()
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!isInvoiceExtractionEnabled()) {
    return NextResponse.json({ enabled: false, extracted: null })
  }

  const form = await request.formData()
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 })
  }
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf) {
    return NextResponse.json({ error: 'Only PDF invoices are supported' }, { status: 400 })
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const extracted = await extractInvoiceFields(base64)
  if (!extracted) {
    return NextResponse.json({ enabled: true, extracted: null })
  }

  // Match the extracted vendor name to an existing vendor contact (case-insensitive).
  let vendorContactId: string | null = null
  if (extracted.vendor_name) {
    const target = extracted.vendor_name.trim().toLowerCase()
    const supabase = await createClient()
    const { data } = await supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('is_vendor', true)
    vendorContactId =
      (data ?? []).find((c) => c.display_name.trim().toLowerCase() === target)?.id ?? null
  }

  return NextResponse.json({
    enabled: true,
    extracted: { ...extracted, vendor_contact_id: vendorContactId },
  })
}
