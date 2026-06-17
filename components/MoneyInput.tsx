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
