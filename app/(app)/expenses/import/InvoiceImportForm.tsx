'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { createExpenseFromInvoice } from '@/lib/actions/expenses'
import SubmitButton from '@/components/SubmitButton'
import { withBasePath } from '@/lib/basePath'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import type { Expense, ExpenseCategory } from '@/lib/supabase/types/database'
import ExpenseFormFields from '../ExpenseFormFields'

interface ContactOption {
  id: string
  display_name: string
}
interface TeamMemberOption {
  id: string
  full_name: string
}

interface ExtractedFields {
  found: boolean
  vendor_name: string | null
  vendor_contact_id: string | null
  amount_cents: number | null
  expense_date: string | null
  description: string | null
  likely_1099: boolean
}

type ExtractState =
  | { kind: 'idle' }
  | { kind: 'extracting' }
  | { kind: 'ready'; fields: ExtractedFields | null; enabled: boolean }
  | { kind: 'error'; message: string }

interface InvoiceImportFormProps {
  categories: ExpenseCategory[]
  vendors: ContactOption[]
  teamMembers: TeamMemberOption[]
}

export default function InvoiceImportForm({
  categories,
  vendors,
  teamMembers,
}: InvoiceImportFormProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [state, setState] = useState<ExtractState>({ kind: 'idle' })
  // Remounts ExpenseFormFields so it picks up the extracted default values.
  const [formKey, setFormKey] = useState(0)

  useEffect(
    () => () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    },
    [previewUrl]
  )

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(file))
    setState({ kind: 'extracting' })

    try {
      const body = new FormData()
      body.set('file', file)
      const res = await fetch(withBasePath('/api/invoices/extract'), { method: 'POST', body })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(json.error ?? `Couldn't read the PDF (${res.status})`)
      }
      const json = (await res.json()) as { enabled: boolean; extracted: ExtractedFields | null }
      setState({ kind: 'ready', fields: json.extracted, enabled: json.enabled })
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Extraction failed' })
    }
    setFormKey((k) => k + 1)
  }

  const fields = state.kind === 'ready' ? state.fields : null
  const defaults: Partial<Expense> | undefined = fields
    ? {
        expense_date: fields.expense_date ?? undefined,
        amount_cents: fields.amount_cents ?? undefined,
        description: fields.description ?? undefined,
        is_1099_eligible: fields.likely_1099,
        vendor_contact_id: fields.vendor_contact_id ?? undefined,
      }
    : undefined

  const hasFile = previewUrl !== null
  const showForm = state.kind === 'ready' || state.kind === 'error'

  return (
    <form
      action={createExpenseFromInvoice}
      className={hasFile ? 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start' : ''}
    >
      <div className="card p-6 space-y-5">
        <div>
          <label htmlFor="invoice_file" className="block text-sm font-medium text-gray-700 mb-1">
            Invoice PDF *
          </label>
          <input
            id="invoice_file"
            name="invoice_file"
            type="file"
            accept=".pdf,application/pdf"
            required
            onChange={handleFile}
            className="block w-full text-sm text-gray-700 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
          />
          <p className="text-xs text-gray-500 mt-1">
            We&rsquo;ll read the vendor, amount, and date and pre-fill the form below for you to
            review. The PDF is saved as the receipt.
          </p>
        </div>

        {state.kind === 'extracting' && (
          <p className="text-sm text-gray-500">Reading invoice…</p>
        )}

        {state.kind === 'error' && (
          <p className="text-sm text-amber-700">
            Couldn&rsquo;t auto-read this PDF ({state.message}). Enter the details by hand below.
          </p>
        )}

        {state.kind === 'ready' && !state.enabled && (
          <p className="text-sm text-amber-700">
            Auto-extraction is off (no Claude API key configured). Enter the details by hand below.
          </p>
        )}

        {state.kind === 'ready' && state.fields && (
          <div className="rounded-lg border border-green-100 bg-green-50 p-3 text-xs text-gray-700">
            <p className="mb-1 font-medium text-gray-800">Read from the invoice — please review:</p>
            <ul className="space-y-0.5">
              <li>
                Vendor: {state.fields.vendor_name ?? '—'}
                {state.fields.vendor_name && !state.fields.vendor_contact_id && (
                  <span className="text-amber-700"> (not in contacts — add it as a new vendor)</span>
                )}
              </li>
              <li>Amount: {formatCents(state.fields.amount_cents)}</li>
              <li>Date: {state.fields.expense_date ? formatDate(state.fields.expense_date) : '—'}</li>
            </ul>
          </div>
        )}

        {showForm && (
          <ExpenseFormFields
            key={formKey}
            categories={categories}
            vendors={vendors}
            teamMembers={teamMembers}
            expense={defaults}
          />
        )}

        {showForm && (
          <div className="flex items-center gap-3 pt-2">
            <SubmitButton pendingLabel="Saving…">Create expense</SubmitButton>
            <Link href="/expenses" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        )}
      </div>

      {hasFile && (
        <div className="lg:sticky lg:top-6 lg:self-start">
          <div className="card overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-medium text-gray-700">
              Invoice preview
            </div>
            {previewUrl && (
              <embed src={previewUrl} type="application/pdf" className="h-[80vh] w-full bg-white" />
            )}
          </div>
        </div>
      )}
    </form>
  )
}
