import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import ContributionForm from './ContributionForm'

export default async function NewContributionPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('bio_contacts')
    .select('id, display_name')
    .order('display_name')

  // Cast needed: hand-written interface row types resolve to `never` with supabase-js
  const contacts = (data ?? []) as unknown as { id: string; display_name: string }[]

  return (
    <div>
      <PageHeader
        title="Record contribution"
        description="Log a donation and generate the IRS acknowledgement letter"
      />
      <div className="max-w-2xl">
        <ContributionForm contacts={contacts} />
      </div>
    </div>
  )
}
