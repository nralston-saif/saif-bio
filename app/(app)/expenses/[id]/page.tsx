import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import SubmitButton from '@/components/SubmitButton'
import AttachmentsPanel from '@/components/AttachmentsPanel'
import { updateExpense } from '@/lib/actions/expenses'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import ExpenseFormFields from '../ExpenseFormFields'
import DeleteExpenseButton from './DeleteExpenseButton'

export default async function ExpenseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: expense } = await supabase
    .from('bio_expenses')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!expense) notFound()

  const [{ data: categories }, { data: vendors }, { data: teamMembers }, { data: attachments }] =
    await Promise.all([
      supabase.from('bio_expense_categories').select('*').order('name'),
      supabase
        .from('bio_contacts')
        .select('id, display_name')
        .eq('is_vendor', true)
        .order('display_name'),
      supabase.from('bio_team_members').select('id, full_name').order('full_name'),
      supabase
        .from('bio_attachments')
        .select('*')
        .eq('entity_type', 'expense')
        .eq('entity_id', id)
        .order('created_at', { ascending: false }),
    ])

  return (
    <div className="max-w-2xl">
      <PageHeader
        title={expense.description}
        description={`${formatDate(expense.expense_date)} · ${formatCents(expense.amount_cents)}`}
      >
        <StatusBadge status={expense.status} />
      </PageHeader>

      <div className="space-y-6">
        <form action={updateExpense.bind(null, id)} className="card p-6">
          <ExpenseFormFields
            categories={categories ?? []}
            vendors={vendors ?? []}
            teamMembers={teamMembers ?? []}
            expense={expense}
          />

          <div className="flex items-center justify-end mt-6">
            <SubmitButton>Save changes</SubmitButton>
          </div>
        </form>

        <AttachmentsPanel
          entityType="expense"
          entityId={id}
          attachments={attachments ?? []}
          revalidatePath={`/expenses/${id}`}
          title="Receipts"
        />

        {expense.disbursement_id ? (
          <div className="card p-4 bg-blue-50 border-blue-100 text-sm text-blue-800">
            Auto-created from a grant disbursement. Delete the disbursement to remove this
            expense.
          </div>
        ) : (
          <div className="card p-5 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-500">
              Permanently remove this expense and its history.
            </p>
            <DeleteExpenseButton expenseId={id} />
          </div>
        )}
      </div>
    </div>
  )
}
