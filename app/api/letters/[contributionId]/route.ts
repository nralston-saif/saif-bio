import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/** Stream the generated acknowledgement letter PDF for inline preview */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ contributionId: string }> }
) {
  const { contributionId } = await params
  const supabase = await createClient()

  // RLS-scoped read doubles as the auth check: non-partners see no rows
  const { data: letter } = await supabase
    .from('bio_acknowledgement_letters')
    .select('pdf_storage_path')
    .eq('contribution_id', contributionId)
    .maybeSingle()

  if (!letter?.pdf_storage_path) {
    return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: pdfBlob, error } = await admin.storage
    .from('letters')
    .download(letter.pdf_storage_path)

  if (error || !pdfBlob) {
    return NextResponse.json({ error: 'Could not load PDF' }, { status: 500 })
  }

  return new NextResponse(pdfBlob.stream(), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="contribution-acknowledgement.pdf"',
    },
  })
}
