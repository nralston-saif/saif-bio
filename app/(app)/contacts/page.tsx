import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import EmptyState from '@/components/EmptyState'
import type { Contact } from '@/lib/supabase/types/database'

const TYPE_FILTERS = [
  { key: 'donor', label: 'Donors', column: 'is_donor' },
  { key: 'grantee', label: 'Grantees', column: 'is_grantee' },
  { key: 'funder', label: 'Funders', column: 'is_funder' },
  { key: 'vendor', label: 'Vendors', column: 'is_vendor' },
] as const

function FlagBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-600">
      {label}
    </span>
  )
}

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { type } = await searchParams
  const activeFilter = TYPE_FILTERS.find((f) => f.key === type)

  const supabase = await createClient()
  let query = supabase.from('bio_contacts').select('*').order('display_name')
  if (activeFilter) {
    query = query.eq(activeFilter.column, true)
  }
  const { data } = await query
  // Cast needed: hand-written interface row types resolve to `never` with supabase-js
  const contacts = (data ?? []) as unknown as Contact[]

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Donors, grantees, funders, and vendors"
        action={{ href: '/contacts/new', label: 'New contact' }}
      />

      <div className="flex flex-wrap gap-2 mb-4">
        <Link
          href="/contacts"
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            !activeFilter
              ? 'bg-gray-900 text-white border-gray-900'
              : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          All
        </Link>
        {TYPE_FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/contacts?type=${f.key}`}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              activeFilter?.key === f.key
                ? 'bg-gray-900 text-white border-gray-900'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          message={
            activeFilter
              ? `No ${activeFilter.label.toLowerCase()} yet.`
              : 'No contacts yet. Add your first contact to get started.'
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Flags</th>
                <th className="px-4 py-3 font-medium">W-9</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/contacts/${contact.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {contact.display_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600 capitalize">{contact.contact_type}</td>
                  <td className="px-4 py-3 text-gray-600">{contact.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {contact.is_donor && <FlagBadge label="Donor" />}
                      {contact.is_grantee && <FlagBadge label="Grantee" />}
                      {contact.is_funder && <FlagBadge label="Funder" />}
                      {contact.is_vendor && <FlagBadge label="Vendor" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{contact.w9_on_file ? 'Yes' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
