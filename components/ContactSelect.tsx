interface ContactOption {
  id: string
  display_name: string
}

interface ContactSelectProps {
  name: string
  contacts: ContactOption[]
  defaultValue?: string | null
  required?: boolean
  placeholder?: string
}

/** Server-component-friendly contact dropdown. Pass pre-fetched contacts. */
export default function ContactSelect({
  name,
  contacts,
  defaultValue,
  required,
  placeholder = 'Select a contact…',
}: ContactSelectProps) {
  return (
    <select name={name} defaultValue={defaultValue ?? ''} required={required} className="input">
      <option value="" disabled>
        {placeholder}
      </option>
      {contacts.map((contact) => (
        <option key={contact.id} value={contact.id}>
          {contact.display_name}
        </option>
      ))}
    </select>
  )
}
