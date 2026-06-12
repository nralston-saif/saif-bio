'use client'

import { useState, useTransition } from 'react'
import { createContribution, updateContribution } from '@/lib/actions/contributions'
import MoneyInput from '@/components/MoneyInput'
import ContactSelect from '@/components/ContactSelect'
import { useToast } from '@/components/Toast'
import { centsToDollarString } from '@/lib/utils/money'
import { todayISO } from '@/lib/utils/dates'
import type {
  Contribution,
  ContributionMethod,
  Restriction,
} from '@/lib/supabase/types/database'
import { METHOD_LABELS } from '../methods'

interface ContributionFormProps {
  contacts: { id: string; display_name: string }[]
  /** When provided the form edits this contribution instead of creating one. */
  contribution?: Contribution
}

function isNextRedirect(err: unknown): boolean {
  return Boolean(
    (err as Error & { digest?: string })?.digest?.startsWith('NEXT_REDIRECT')
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs font-medium text-gray-600 mb-1">{children}</span>
}

export default function ContributionForm({ contacts, contribution }: ContributionFormProps) {
  const [method, setMethod] = useState<ContributionMethod>(contribution?.method ?? 'check')
  const [restriction, setRestriction] = useState<Restriction>(
    contribution?.restriction ?? 'unrestricted'
  )
  const [quidProQuo, setQuidProQuo] = useState(contribution?.quid_pro_quo ?? false)
  const [isPending, startTransition] = useTransition()
  const { showToast } = useToast()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)

    startTransition(async () => {
      try {
        if (contribution) {
          await updateContribution(contribution.id, formData)
          showToast('Contribution updated', 'success')
        } else {
          await createContribution(formData)
        }
      } catch (err) {
        // createContribution redirects on success; redirect() throws and must
        // be rethrown so Next can perform the navigation
        if (isNextRedirect(err)) throw err
        showToast(err instanceof Error ? err.message : 'Could not save contribution', 'error')
      }
    })
  }

  const inKind = method === 'in_kind'

  return (
    <form onSubmit={handleSubmit} className="card p-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="block sm:col-span-2">
          <Label>Donor *</Label>
          <ContactSelect
            name="contact_id"
            contacts={contacts}
            defaultValue={contribution?.contact_id}
            required
          />
        </label>

        <label className="block">
          <Label>Received date *</Label>
          <input
            type="date"
            name="received_date"
            required
            defaultValue={contribution?.received_date ?? todayISO()}
            className="input"
          />
        </label>

        <label className="block">
          <Label>Method *</Label>
          <select
            name="method"
            required
            value={method}
            onChange={(e) => setMethod(e.target.value as ContributionMethod)}
            className="input"
          >
            {(Object.keys(METHOD_LABELS) as ContributionMethod[]).map((m) => (
              <option key={m} value={m}>
                {METHOD_LABELS[m]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <Label>{inKind ? 'Fair-market value (optional)' : 'Amount *'}</Label>
          <MoneyInput
            name="amount"
            required={!inKind}
            defaultValue={centsToDollarString(contribution?.amount_cents)}
          />
        </label>

        {method === 'check' && (
          <label className="block">
            <Label>Check number</Label>
            <input
              name="check_number"
              defaultValue={contribution?.check_number ?? ''}
              className="input"
            />
          </label>
        )}

        {inKind && (
          <label className="block sm:col-span-2">
            <Label>Description of donated property *</Label>
            <textarea
              name="in_kind_description"
              required
              rows={3}
              defaultValue={contribution?.in_kind_description ?? ''}
              className="input"
              placeholder="Describe the donated goods or property (do not assign a value in the letter)"
            />
          </label>
        )}

        <label className="block">
          <Label>Restriction</Label>
          <select
            name="restriction"
            value={restriction}
            onChange={(e) => setRestriction(e.target.value as Restriction)}
            className="input"
          >
            <option value="unrestricted">Unrestricted</option>
            <option value="donor_restricted">Donor restricted</option>
          </select>
        </label>

        {restriction === 'donor_restricted' && (
          <label className="block">
            <Label>Restriction purpose</Label>
            <input
              name="restriction_purpose"
              defaultValue={contribution?.restriction_purpose ?? ''}
              className="input"
              placeholder="e.g. Biosecurity fellowship program"
            />
          </label>
        )}

        <label className="flex items-start gap-2 sm:col-span-2 mt-1">
          <input
            type="checkbox"
            name="quid_pro_quo"
            checked={quidProQuo}
            onChange={(e) => setQuidProQuo(e.target.checked)}
            className="mt-0.5 rounded border-gray-300"
          />
          <span className="text-sm text-gray-700">
            Donor received goods or services in exchange (quid pro quo)
          </span>
        </label>

        {quidProQuo && (
          <div className="sm:col-span-2 rounded-lg bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <p className="text-xs text-gray-500 sm:col-span-2">
              Required by the IRS for payments over $75 where the donor receives goods or
              services. The acknowledgement letter must describe them and state their
              good-faith value.
            </p>
            <label className="block sm:col-span-2">
              <Label>Description of goods/services *</Label>
              <input
                name="goods_services_description"
                required
                defaultValue={contribution?.goods_services_description ?? ''}
                className="input"
                placeholder="e.g. Gala dinner ticket"
              />
            </label>
            <label className="block">
              <Label>Good-faith value *</Label>
              <MoneyInput
                name="goods_services_value"
                required
                defaultValue={centsToDollarString(contribution?.goods_services_value_cents)}
              />
            </label>
          </div>
        )}

        <label className="block sm:col-span-2">
          <Label>Notes</Label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={contribution?.notes ?? ''}
            className="input"
          />
        </label>
      </div>

      <div className="mt-6 flex justify-end">
        <button type="submit" disabled={isPending} className="btn btn-primary">
          {isPending ? 'Saving…' : contribution ? 'Save changes' : 'Record contribution'}
        </button>
      </div>
    </form>
  )
}
