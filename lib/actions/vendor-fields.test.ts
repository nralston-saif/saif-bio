import { describe, expect, it } from 'vitest'
import { vendorFieldsFromInput } from './vendor-fields'

describe('vendorFieldsFromInput', () => {
  it('always flags the contact as a vendor and trims the name', () => {
    const f = vendorFieldsFromInput({ display_name: '  Acme Consulting LLC  ', contact_type: 'organization' })
    expect(f.is_vendor).toBe(true)
    expect(f.display_name).toBe('Acme Consulting LLC')
    expect(f.contact_type).toBe('organization')
    expect(f.tax_id).toBeNull()
    expect(f.w9_on_file).toBe(false)
  })

  it('keeps an individual vendor type', () => {
    expect(vendorFieldsFromInput({ display_name: 'Jane Doe', contact_type: 'individual' }).contact_type).toBe(
      'individual'
    )
  })

  it('normalizes a blank tax id to null and trims a real one', () => {
    expect(
      vendorFieldsFromInput({ display_name: 'X', contact_type: 'organization', tax_id: '   ' }).tax_id
    ).toBeNull()
    expect(
      vendorFieldsFromInput({ display_name: 'X', contact_type: 'organization', tax_id: ' 12-3456789 ' }).tax_id
    ).toBe('12-3456789')
  })

  it('coerces the W-9 flag to a boolean', () => {
    expect(
      vendorFieldsFromInput({ display_name: 'X', contact_type: 'organization', w9_on_file: true }).w9_on_file
    ).toBe(true)
    expect(vendorFieldsFromInput({ display_name: 'X', contact_type: 'organization' }).w9_on_file).toBe(false)
  })
})
