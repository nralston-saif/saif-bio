'use client'

interface MoneyInputProps {
  name: string
  defaultValue?: string
  /** When provided, the input is controlled (pair with onChange). */
  value?: string
  onChange?: (value: string) => void
  required?: boolean
  placeholder?: string
  readOnly?: boolean
  /** Max decimal places the input accepts. Defaults to 2 (whole cents). */
  maxDecimals?: number
}

/**
 * Reformat a whole-dollar entry with thousands separators on blur:
 * "1000" -> "1,000.00". Leaves blank or unparseable input untouched so the
 * pattern validation can still flag it. parseDollarsToCents strips the commas.
 */
function formatWholeDollars(raw: string): string {
  const cleaned = raw.replace(/[$,\s]/g, '')
  if (cleaned === '') return ''
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n < 0) return raw
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n)
}

/** Dollar-amount text input. Submit value is dollars; parse server-side with parseDollarsToCents. */
export default function MoneyInput({
  name,
  defaultValue,
  value,
  onChange,
  required,
  placeholder,
  readOnly,
  maxDecimals = 2,
}: MoneyInputProps) {
  const controlled = value !== undefined
  // Only the whole-dollar (2-decimal) case gets comma formatting; per-share
  // inputs use more decimals and shouldn't be reformatted. Controlled inputs
  // are owned by their parent, so we don't rewrite their value here.
  const autoFormat = !controlled && !readOnly && maxDecimals === 2
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900 text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        {...(controlled
          ? { value, onChange: (e) => onChange?.(e.target.value) }
          : { defaultValue })}
        {...(autoFormat
          ? { onBlur: (e) => (e.currentTarget.value = formatWholeDollars(e.currentTarget.value)) }
          : {})}
        required={required}
        readOnly={readOnly}
        placeholder={placeholder ?? '0.00'}
        pattern={`[0-9,]*\\.?[0-9]{0,${maxDecimals}}`}
        // Inline padding-left so the leading "$" never overlaps the first digit
        // (a Tailwind utility loses the cascade to the `.input` shorthand padding).
        style={{ paddingLeft: '1.75rem' }}
        className={`input${readOnly ? ' bg-gray-100 text-gray-600' : ''}`}
      />
    </div>
  )
}
