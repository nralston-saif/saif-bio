import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createProposal } from '@/lib/actions/grants-out'
import PageHeader from '@/components/PageHeader'
import ApplicantSelect from '@/components/ApplicantSelect'
import MoneyInput from '@/components/MoneyInput'
import SubmitButton from '@/components/SubmitButton'
import LetterUploadForm from './LetterUploadForm'
import { PROGRAM_AREAS } from '@/lib/grants/program-areas'

type Contact = { id: string; display_name: string }

function ProposalFields({ contacts }: { contacts: Contact[] }) {
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Applicant *</label>
        <ApplicantSelect name="applicant_contact_id" contacts={contacts} required />
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
          <select id="program_area" name="program_area" defaultValue="" className="input">
            <option value="">Select…</option>
            {PROGRAM_AREAS.map((area) => (
              <option key={area} value={area}>
                {area}
              </option>
            ))}
          </select>
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
          <p className="mt-1 text-xs text-gray-400">Optional — leave blank if not yet received.</p>
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
    </>
  )
}

export default async function NewProposalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab: 'manual' | 'upload' = tab === 'upload' ? 'upload' : 'manual'

  const supabase = await createClient()
  const { data: contacts } = await supabase
    .from('bio_contacts')
    .select('id, display_name')
    .order('display_name')

  const tabs = [
    { key: 'manual' as const, label: 'Manual entry', href: '/grants-out/new?tab=manual' },
    { key: 'upload' as const, label: 'Upload letter', href: '/grants-out/new?tab=upload' },
  ]

  return (
    <div className={activeTab === 'upload' ? 'max-w-6xl' : 'max-w-2xl'}>
      <PageHeader
        title="New proposal"
        description="Log an incoming grant proposal for partner review."
      />

      <p className="text-sm text-gray-500 mb-4">
        Create the applicant as a{' '}
        <Link href="/contacts/new" className="text-gray-900 underline hover:no-underline">
          contact
        </Link>{' '}
        first if needed.
      </p>

      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={t.href}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === t.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {activeTab === 'manual' ? (
        <form action={createProposal} className="card p-6 space-y-5">
          <ProposalFields contacts={contacts ?? []} />

          <div className="flex items-center gap-3 pt-2">
            <SubmitButton pendingLabel="Creating…">Create proposal</SubmitButton>
            <Link href="/grants-out" className="btn btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      ) : (
        <LetterUploadForm contacts={contacts ?? []} />
      )}
    </div>
  )
}
