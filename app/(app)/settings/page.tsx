import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import SubmitButton from '@/components/SubmitButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import { updateSettings } from '@/lib/actions/settings'

const GOVERNANCE_ENTITY_ID = '00000000-0000-0000-0000-000000000000'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export default async function SettingsPage() {
  const supabase = await createClient()

  const [settingsRes, membersRes, attachmentsRes] = await Promise.all([
    supabase.from('bio_settings').select('*').eq('id', 1).maybeSingle(),
    supabase.from('bio_team_members').select('*').order('full_name'),
    supabase
      .from('bio_attachments')
      .select('*')
      .eq('entity_type', 'governance')
      .eq('entity_id', GOVERNANCE_ENTITY_ID)
      .order('created_at', { ascending: false }),
  ])

  const settings = settingsRes.data
  const members = membersRes.data ?? []

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Organization details, team, and governance documents" />

      <div className="space-y-6">
        <form action={updateSettings} className="card p-6">
          <h2 className="font-medium text-gray-900 mb-4">Organization</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Legal name *
              </label>
              <input
                type="text"
                name="org_legal_name"
                defaultValue={settings?.org_legal_name ?? ''}
                required
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">EIN</label>
              <input
                type="text"
                name="ein"
                defaultValue={settings?.ein ?? ''}
                className="input"
                placeholder="12-3456789"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address line 1</label>
              <input
                type="text"
                name="address_line1"
                defaultValue={settings?.address_line1 ?? ''}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Address line 2</label>
              <input
                type="text"
                name="address_line2"
                defaultValue={settings?.address_line2 ?? ''}
                className="input"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">City</label>
              <input
                type="text"
                name="city"
                defaultValue={settings?.city ?? ''}
                className="input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">State</label>
                <input
                  type="text"
                  name="state"
                  defaultValue={settings?.state ?? ''}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Postal code</label>
                <input
                  type="text"
                  name="postal_code"
                  defaultValue={settings?.postal_code ?? ''}
                  className="input"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Fiscal year start month
              </label>
              <select
                name="fiscal_year_start_month"
                defaultValue={String(settings?.fiscal_year_start_month ?? 1)}
                className="input"
              >
                {MONTH_NAMES.map((month, index) => (
                  <option key={month} value={String(index + 1)}>
                    {month}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h2 className="font-medium text-gray-900 mt-8 mb-1">Acknowledgement letters</h2>
          <p className="text-xs text-gray-400 mb-4">
            EIN and a letter signatory are required before acknowledgement letters can be
            generated.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Signatory name
              </label>
              <input
                type="text"
                name="letter_signatory_name"
                defaultValue={settings?.letter_signatory_name ?? ''}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Signatory title
              </label>
              <input
                type="text"
                name="letter_signatory_title"
                defaultValue={settings?.letter_signatory_title ?? ''}
                className="input"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From email</label>
              <input
                type="email"
                name="letter_from_email"
                defaultValue={settings?.letter_from_email ?? ''}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Closing text</label>
              <textarea
                name="letter_closing_text"
                defaultValue={settings?.letter_closing_text ?? ''}
                rows={3}
                className="input"
              />
            </div>
          </div>

          <div className="mt-6">
            <SubmitButton>Save settings</SubmitButton>
          </div>
        </form>

        <div className="card p-6">
          <h2 className="font-medium text-gray-900 mb-3">Team</h2>
          {members.length === 0 ? (
            <p className="text-sm text-gray-400">No team members yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {members.map((member) => (
                <li key={member.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {member.full_name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{member.email}</p>
                  </div>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      member.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500'
                    }`}
                  >
                    {member.is_active ? 'Active' : 'Inactive'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <AttachmentsPanel
            entityType="governance"
            entityId={GOVERNANCE_ENTITY_ID}
            attachments={attachmentsRes.data ?? []}
            revalidatePath="/settings"
            title="Governance documents"
          />
          <p className="text-xs text-gray-400 mt-2 px-1">
            Bylaws, IRS determination letter, COI policy, board minutes.
          </p>
        </div>
      </div>
    </div>
  )
}
