import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createProposal } from '@/lib/actions/grants-out'
import PageHeader from '@/components/PageHeader'
import ContactSelect from '@/components/ContactSelect'
import MoneyInput from '@/components/MoneyInput'
import SubmitButton from '@/components/SubmitButton'

export default async function NewProposalPage() {
  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('bio_contacts')
    .select('id, display_name')
    .order('display_name')

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New proposal"
        description="Log an incoming grant proposal for partner review."
      />

      <p className="text-sm text-gray-500 mb-4">
        Proposals arrive by email — create the applicant as a{' '}
        <Link href="/contacts/new" className="text-gray-900 underline hover:no-underline">
          contact
        </Link>{' '}
        first if needed.
      </p>

      <form action={createProposal} className="card p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Applicant *</label>
          <ContactSelect name="applicant_contact_id" contacts={contacts ?? []} required />
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
            Title *
          </label>
          <input id="title" name="title" type="text" required className="input" />
        </div>

        <div>
          <label htmlFor="summary" className="block text-sm font-medium text-gray-700 mb-1">
            Summary
          </label>
          <textarea id="summary" name="summary" rows={4} className="input" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="program_area" className="block text-sm font-medium text-gray-700 mb-1">
              Program area
            </label>
            <input id="program_area" name="program_area" type="text" className="input" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount requested</label>
            <MoneyInput name="amount_requested" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="received_date" className="block text-sm font-medium text-gray-700 mb-1">
              Received date
            </label>
            <input id="received_date" name="received_date" type="date" className="input" />
          </div>
          <div>
            <label htmlFor="source" className="block text-sm font-medium text-gray-700 mb-1">
              Source
            </label>
            <input
              id="source"
              name="source"
              type="text"
              placeholder="e.g. email, referral"
              className="input"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <SubmitButton pendingLabel="Creating…">Create proposal</SubmitButton>
          <Link href="/grants-out" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
