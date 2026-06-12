import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import SubmitButton from '@/components/SubmitButton'
import { createGrantIn } from '@/lib/actions/grants-in'
import GrantInFormFields from '../GrantInFormFields'

export default async function NewGrantInPage() {
  const supabase = await createClient()

  const [fundersRes, membersRes] = await Promise.all([
    supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('is_funder', true)
      .order('display_name'),
    supabase
      .from('bio_team_members')
      .select('id, full_name')
      .eq('is_active', true)
      .order('full_name'),
  ])

  let funders = fundersRes.data ?? []
  if (funders.length === 0) {
    const { data: allContacts } = await supabase
      .from('bio_contacts')
      .select('id, display_name')
      .order('display_name')
    funders = allContacts ?? []
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New grant application"
        description="Track a funding opportunity SAIF Bio is applying for"
      />

      <form action={createGrantIn} className="card p-6">
        <GrantInFormFields funders={funders} members={membersRes.data ?? []} />
        <div className="flex items-center gap-3 mt-6">
          <SubmitButton pendingLabel="Creating…">Create application</SubmitButton>
          <Link href="/grants-in" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
