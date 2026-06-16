import Anthropic from '@anthropic-ai/sdk'
import { parseInvoiceResult, stripCodeFence, type ExtractedInvoice } from './normalize'

// Cheap, structured extraction — invoices are bounded and well-formed.
const MODEL = 'claude-haiku-4-5'

const PROMPT = `You are extracting bookkeeping fields from a vendor invoice or receipt for a US nonprofit.
Return ONLY a JSON object (no prose, no markdown fences) with exactly these keys:
{
  "found": boolean,            // true if this document is an invoice, bill, or receipt
  "vendor_name": string|null,  // the company or person billing us (the payee); never our own organization
  "total_amount": string|null, // the total amount due, as a plain number with no currency symbol or thousands separators, e.g. "1234.56"
  "invoice_date": string|null, // the invoice date (or the due date if there is no invoice date), formatted strictly as YYYY-MM-DD
  "description": string|null,  // a short description of the goods or services (max ~80 characters)
  "likely_1099": boolean       // true if this looks like payment for SERVICES to an individual or unincorporated business (not a corporation, not goods)
}
Use null for any field you cannot determine. Respond with the JSON object only.`

export function isInvoiceExtractionEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY)
}

/**
 * Ask Claude to read a base64 PDF invoice and return normalized expense fields.
 * Returns null when extraction is unavailable (no key) or fails — callers fall
 * back to manual entry. Never throws.
 */
export async function extractInvoiceFields(base64Pdf: string): Promise<ExtractedInvoice | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null

  try {
    const client = new Anthropic()
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: base64Pdf },
            },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    })

    const textBlock = response.content.find((block) => block.type === 'text')
    if (!textBlock || textBlock.type !== 'text') return null

    let raw: unknown
    try {
      raw = JSON.parse(stripCodeFence(textBlock.text))
    } catch {
      return null
    }
    return parseInvoiceResult(raw)
  } catch {
    return null
  }
}
