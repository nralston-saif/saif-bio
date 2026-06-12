import ContactSelect from '@/components/ContactSelect'
import MoneyInput from '@/components/MoneyInput'
import { centsToDollarString } from '@/lib/utils/money'
import type { GrantIn, GrantInStatus } from '@/lib/supabase/types/database'

const STATUS_OPTIONS: { value: GrantInStatus; label: string }[] = [
  { value: 'prospect', label: 'Prospect' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'awarded', label: 'Awarded' },
  { value: 'declined', label: 'Declined' },
  { value: 'withdrawn', label: 'Withdrawn' },
]

interface GrantInFormFieldsProps {
  funders: { id: string; display_name: string }[]
  members: { id: string; full_name: string }[]
  grant?: GrantIn
}

/** Shared field set for the create and edit grant-in forms. */
export default function GrantInFormFields({ funders, members, grant }: GrantInFormFieldsProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Funder *</label>
        <ContactSelect
          name="funder_contact_id"
          contacts={funders}
          defaultValue={grant?.funder_contact_id}
          required
          placeholder="Select a funder…"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Opportunity name *</label>
        <input
          type="text"
          name="opportunity_name"
          defaultValue={grant?.opportunity_name ?? ''}
          required
          className="input"
          placeholder="e.g. 2026 Biosecurity Research RFP"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Program</label>
        <input
          type="text"
          name="program"
          defaultValue={grant?.program ?? ''}
          className="input"
          placeholder="Program or focus area"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Owner</label>
        <select name="owner_id" defaultValue={grant?.owner_id ?? ''} className="input">
          <option value="">No owner</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount requested</label>
        <MoneyInput
          name="amount_requested"
          defaultValue={centsToDollarString(grant?.amount_requested_cents)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount awarded</label>
        <MoneyInput
          name="amount_awarded"
          defaultValue={centsToDollarString(grant?.amount_awarded_cents)}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
        <select name="status" defaultValue={grant?.status ?? 'prospect'} className="input">
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Restriction</label>
        <select name="restriction" defaultValue={grant?.restriction ?? ''} className="input">
          <option value="">Not specified</option>
          <option value="unrestricted">Unrestricted</option>
          <option value="donor_restricted">Donor restricted</option>
        </select>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Application deadline</label>
        <input
          type="date"
          name="application_deadline"
          defaultValue={grant?.application_deadline ?? ''}
          className="input"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Submitted date</label>
        <input
          type="date"
          name="submitted_date"
          defaultValue={grant?.submitted_date ?? ''}
          className="input"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Decision date</label>
        <input
          type="date"
          name="decision_date"
          defaultValue={grant?.decision_date ?? ''}
          className="input"
        />
      </div>
      <div />

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Grant period start</label>
        <input
          type="date"
          name="grant_period_start"
          defaultValue={grant?.grant_period_start ?? ''}
          className="input"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Grant period end</label>
        <input
          type="date"
          name="grant_period_end"
          defaultValue={grant?.grant_period_end ?? ''}
          className="input"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <textarea
          name="notes"
          defaultValue={grant?.notes ?? ''}
          rows={4}
          className="input"
          placeholder="Internal notes about this application"
        />
      </div>
    </div>
  )
}
