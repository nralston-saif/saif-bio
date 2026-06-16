import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import InvoiceImportForm from './InvoiceImportForm'

export default async function ImportInvoicePage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: vendors }, { data: teamMembers }] = await Promise.all([
    supabase.from('bio_expense_categories').select('*').eq('is_active', true).order('name'),
    supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('is_vendor', true)
      .order('display_name'),
    supabase.from('bio_team_members').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Import invoice"
        description="Upload an invoice PDF — we'll pre-fill the expense for you to review and save the PDF as the receipt."
      />

      <InvoiceImportForm
        categories={categories ?? []}
        vendors={vendors ?? []}
        teamMembers={teamMembers ?? []}
      />
    </div>
  )
}
