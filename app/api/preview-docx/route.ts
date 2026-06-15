import { NextResponse } from 'next/server'
import mammoth from 'mammoth'

const MAX_BYTES = 10 * 1024 * 1024

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 413 })
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer())
    const { value: html } = await mammoth.convertToHtml({ buffer })
    return NextResponse.json({ html })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse document' },
      { status: 500 }
    )
  }
}
