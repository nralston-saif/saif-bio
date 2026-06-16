'use client'

import { useState } from 'react'
import { createVendorInline } from '@/lib/actions/contacts'
import type { ContactType } from '@/lib/supabase/types/database'

interface ContactOption {
  id: string
  display_name: string
}

interface VendorSelectProps {
  name: string
  contacts: ContactOption[]
  defaultValue?: string | null
  placeholder?: string
}

const ADD_NEW = '__add_new__'
const labelClass = 'block text-xs font-medium text-gray-600 mb-1'

/**
 * Vendor picker with an inline "add new vendor" panel, so a vendor can be
 * created without leaving a half-filled expense form. The chosen vendor id is
 * submitted via a hidden input named `name`; the inline-form inputs are
 * unnamed React state so they never post with the surrounding expense form.
 */
export default function VendorSelect({
  name,
  contacts,
  defaultValue,
  placeholder = 'Select a vendor…',
}: VendorSelectProps) {
  const [options, setOptions] = useState<ContactOption[]>(contacts)
  const [selected, setSelected] = useState<string>(defaultValue ?? '')
  const [adding, setAdding] = useState(false)

  const [vName, setVName] = useState('')
  const [vType, setVType] = useState<ContactType>('organization')
  const [vTaxId, setVTaxId] = useState('')
  const [vW9, setVW9] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const openAddPanel = () => {
    setError('')
    setAdding(true)
  }

  const cancelAdd = () => {
    setAdding(false)
    setError('')
    setVName('')
    setVType('organization')
    setVTaxId('')
    setVW9(false)
  }

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === ADD_NEW) {
      openAddPanel()
      return // leave `selected` unchanged; controlled <select> snaps back
    }
    setSelected(e.target.value)
  }

  const saveVendor = async () => {
    setError('')
    if (!vName.trim()) {
      setError('Vendor name is required')
      return
    }
    setSaving(true)
    const result = await createVendorInline({
      display_name: vName,
      contact_type: vType,
      tax_id: vTaxId,
      w9_on_file: vW9,
    })
    setSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    setOptions((prev) =>
      [...prev, result.vendor].sort((a, b) => a.display_name.localeCompare(b.display_name))
    )
    setSelected(result.vendor.id)
    cancelAdd()
  }

  return (
    <div>
      <input type="hidden" name={name} value={selected} />

      <select
        className="input"
        aria-label="Vendor"
        value={selected}
        onChange={handleSelectChange}
      >
        <option value="">{placeholder}</option>
        <option value={ADD_NEW}>+ Add new vendor…</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.display_name}
          </option>
        ))}
      </select>

      {adding && (
        <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-sm font-medium text-gray-700 mb-2">New vendor</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={labelClass}>Vendor name</label>
              <input
                type="text"
                value={vName}
                autoFocus
                onChange={(e) => setVName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault() // don't submit the expense form
                    void saveVendor()
                  }
                }}
                className="input"
                placeholder="e.g. Acme Consulting LLC"
              />
            </div>

            <div>
              <label className={labelClass}>Type</label>
              <select
                value={vType}
                onChange={(e) => setVType(e.target.value as ContactType)}
                className="input"
              >
                <option value="organization">Organization</option>
                <option value="individual">Individual</option>
              </select>
            </div>

            <div>
              <label className={labelClass}>EIN / Tax ID (optional)</label>
              <input
                type="text"
                value={vTaxId}
                onChange={(e) => setVTaxId(e.target.value)}
                className="input"
                placeholder="12-3456789"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={vW9}
                  onChange={(e) => setVW9(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                W-9 on file
              </label>
            </div>
          </div>

          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void saveVendor()}
              disabled={saving}
              className="btn btn-primary"
            >
              {saving ? 'Saving…' : 'Save vendor'}
            </button>
            <button type="button" onClick={cancelAdd} disabled={saving} className="btn btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
