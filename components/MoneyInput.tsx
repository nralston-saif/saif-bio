'use client'

interface MoneyInputProps {
  name: string
  defaultValue?: string
  required?: boolean
  placeholder?: string
}

/** Dollar-amount text input. Submit value is dollars; parse server-side with parseDollarsToCents. */
export default function MoneyInput({ name, defaultValue, required, placeholder }: MoneyInputProps) {
  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-900 text-sm">$</span>
      <input
        type="text"
        inputMode="decimal"
        name={name}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder ?? '0.00'}
        pattern="[0-9,]*\.?[0-9]{0,2}"
        className="input pl-7!"
      />
    </div>
  )
}
