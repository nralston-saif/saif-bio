import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import SubmitButton from '@/components/SubmitButton'
import { createExpense } from '@/lib/actions/expenses'
import ExpenseFormFields from '../ExpenseFormFields'

export default async function NewExpensePage() {
  const supabase = await createClient()

  const [{ data: categories }, { data: vendors }, { data: teamMembers }] = await Promise.all([
    supabase
      .from('bio_expense_categories')
      .select('*')
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('bio_contacts')
      .select('id, display_name')
      .eq('is_vendor', true)
      .order('display_name'),
    supabase.from('bio_team_members').select('id, full_name').order('full_name'),
  ])

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New expense"
        description="Record an operating expense for the organization."
      />

      <form action={createExpense} className="card p-6">
        <ExpenseFormFields
          categories={categories ?? []}
          vendors={vendors ?? []}
          teamMembers={teamMembers ?? []}
        />

        <div className="flex items-center justify-end gap-3 mt-6">
          <Link href="/expenses" className="btn btn-secondary">
            Cancel
          </Link>
          <SubmitButton>Create expense</SubmitButton>
        </div>
      </form>
    </div>
  )
}
