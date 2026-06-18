import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// TEMP diagnostic: does the signature download + image-embed work in prod?
export async function GET() {
  const result: Record<string, unknown> = {}
  let signature: string | null = null

  // 1) Download the signature from storage
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.storage.from('letters').download('assets/signature.jpeg')
    if (error) result.download = { ok: false, error: error.message }
    else if (!data) result.download = { ok: false, error: 'no data' }
    else {
      const buf = Buffer.from(await data.arrayBuffer())
      signature = `data:image/jpeg;base64,${buf.toString('base64')}`
      result.download = { ok: true, bytes: buf.length }
    }
  } catch (e) {
    result.download = { ok: false, exception: e instanceof Error ? e.message : String(e) }
  }

  // 2) Render a tiny PDF embedding that signature; big output => image embedded
  try {
    const { renderToBuffer, Document, Page, Image, View } = await import('@react-pdf/renderer')
    const { createElement: h } = await import('react')
    const el = h(
      Document,
      {},
      h(
        Page,
        { size: 'LETTER' },
        signature
          ? h(Image, { src: signature, style: { width: 150, height: 86 } })
          : h(View, {})
      )
    )
    const pdf = await renderToBuffer(el as never)
    result.render = { ok: true, pdfBytes: pdf.length, hadSignature: !!signature }
  } catch (e) {
    result.render = { ok: false, error: e instanceof Error ? e.message : String(e) }
  }

  return NextResponse.json(result)
}
