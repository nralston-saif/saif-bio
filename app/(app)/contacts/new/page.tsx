import PageHeader from '@/components/PageHeader'
import SubmitButton from '@/components/SubmitButton'
import { createContact } from '@/lib/actions/contacts'
import ContactFormFields from '../ContactFormFields'

export default function NewContactPage() {
  return (
    <div>
      <PageHeader
        title="New contact"
        description="Add a donor, grantee, funder, or vendor"
      />

      <form action={createContact} className="card p-6 max-w-3xl">
        <ContactFormFields />
        <div className="mt-6 flex justify-end">
          <SubmitButton pendingLabel="Creating…">Create contact</SubmitButton>
        </div>
      </form>
    </div>
  )
}
