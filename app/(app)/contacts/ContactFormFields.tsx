import type { Contact } from '@/lib/supabase/types/database'

const ROLE_CHECKBOXES = [
  { name: 'is_donor', label: 'Donor' },
  { name: 'is_grantee', label: 'Grantee' },
  { name: 'is_funder', label: 'Funder' },
  { name: 'is_vendor', label: 'Vendor' },
] as const

function Label({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs font-medium text-gray-600 mb-1">{children}</span>
}

/** Shared field set for the contact create + edit forms. */
export default function ContactFormFields({ contact }: { contact?: Contact }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <label className="block">
        <Label>Type *</Label>
        <select
          name="contact_type"
          required
          defaultValue={contact?.contact_type ?? 'individual'}
          className="input"
        >
          <option value="individual">Individual</option>
          <option value="organization">Organization</option>
        </select>
      </label>

      <label className="block">
        <Label>Display name *</Label>
        <input
          name="display_name"
          required
          defaultValue={contact?.display_name ?? ''}
          className="input"
          placeholder="Jane Smith or Acme Foundation"
        />
      </label>

      <label className="block">
        <Label>First name</Label>
        <input name="first_name" defaultValue={contact?.first_name ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>Last name</Label>
        <input name="last_name" defaultValue={contact?.last_name ?? ''} className="input" />
      </label>

      <label className="block sm:col-span-2">
        <Label>Organization name</Label>
        <input name="org_name" defaultValue={contact?.org_name ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>Email</Label>
        <input name="email" type="email" defaultValue={contact?.email ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>Phone</Label>
        <input name="phone" type="tel" defaultValue={contact?.phone ?? ''} className="input" />
      </label>

      <label className="block sm:col-span-2">
        <Label>Address line 1</Label>
        <input name="address_line1" defaultValue={contact?.address_line1 ?? ''} className="input" />
      </label>

      <label className="block sm:col-span-2">
        <Label>Address line 2</Label>
        <input name="address_line2" defaultValue={contact?.address_line2 ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>City</Label>
        <input name="city" defaultValue={contact?.city ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>State</Label>
        <input name="state" defaultValue={contact?.state ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>Postal code</Label>
        <input name="postal_code" defaultValue={contact?.postal_code ?? ''} className="input" />
      </label>

      <label className="block">
        <Label>Country</Label>
        <input name="country" defaultValue={contact?.country ?? 'US'} className="input" />
      </label>

      <label className="block sm:col-span-2">
        <Label>Tax ID (EIN / SSN)</Label>
        <input name="tax_id" defaultValue={contact?.tax_id ?? ''} className="input" />
      </label>

      <fieldset className="sm:col-span-2">
        <legend className="text-xs font-medium text-gray-600 mb-2">Roles</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {ROLE_CHECKBOXES.map((role) => (
            <label key={role.name} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name={role.name}
                defaultChecked={contact?.[role.name] ?? false}
                className="rounded border-gray-300"
              />
              {role.label}
            </label>
          ))}
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              name="w9_on_file"
              defaultChecked={contact?.w9_on_file ?? false}
              className="rounded border-gray-300"
            />
            W-9 on file
          </label>
        </div>
      </fieldset>

      <label className="block sm:col-span-2">
        <Label>Notes</Label>
        <textarea name="notes" rows={3} defaultValue={contact?.notes ?? ''} className="input" />
      </label>
    </div>
  )
}
