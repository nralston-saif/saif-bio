'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, requiredString, optionalString, ActionError } from './helpers'
import { parseDollarsToCents } from '@/lib/utils/money'
import type { ExpensePaymentMethod, ExpenseStatus, FunctionalClass } from '@/lib/supabase/types/database'

function expenseFields(formData: FormData) {
  const amountCents = parseDollarsToCents(requiredString(formData, 'amount'))
  if (amountCents === null) throw new ActionError('Invalid amount')

  return {
    expense_date: requiredString(formData, 'expense_date'),
    amount_cents: amountCents,
    description: requiredString(formData, 'description'),
    category_id: requiredString(formData, 'category_id'),
    vendor_contact_id: optionalString(formData, 'vendor_contact_id'),
    payment_method: optionalString(formData, 'payment_method') as ExpensePaymentMethod | null,
    status: (optionalString(formData, 'status') ?? 'paid') as ExpenseStatus,
    paid_by: optionalString(formData, 'paid_by'),
    is_1099_eligible: formData.get('is_1099_eligible') === 'on',
    notes: optionalString(formData, 'notes'),
  }
}

export async function createExpense(formData: FormData) {
  const memberId = await requireMemberId()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('bio_expenses')
    .insert({ ...expenseFields(formData), entered_by: memberId })
    .select('id')
    .single()

  if (error) throw new ActionError(error.message)

  revalidatePath('/expenses')
  redirect(`/expenses/${data.id}`)
}

export async function updateExpense(expenseId: string, formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_expenses')
    .update(expenseFields(formData))
    .eq('id', expenseId)

  if (error) throw new ActionError(error.message)

  revalidatePath('/expenses')
  revalidatePath(`/expenses/${expenseId}`)
}

export async function deleteExpense(expenseId: string) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase.from('bio_expenses').delete().eq('id', expenseId)
  if (error) throw new ActionError(error.message)

  revalidatePath('/expenses')
  redirect('/expenses')
}

export async function upsertCategory(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const id = optionalString(formData, 'id')
  const fields = {
    name: requiredString(formData, 'name'),
    functional_class: requiredString(formData, 'functional_class') as FunctionalClass,
    form_990_line: optionalString(formData, 'form_990_line'),
    is_active: formData.get('is_active') !== 'off',
  }

  const { error } = id
    ? await supabase.from('bio_expense_categories').update(fields).eq('id', id)
    : await supabase.from('bio_expense_categories').insert(fields)

  if (error) throw new ActionError(error.message)

  revalidatePath('/expenses/categories')
}

export async function setCategoryActive(categoryId: string, isActive: boolean) {
  await requireMemberId()
  const supabase = await createClient()

  const { error } = await supabase
    .from('bio_expense_categories')
    .update({ is_active: isActive })
    .eq('id', categoryId)

  if (error) throw new ActionError(error.message)
  revalidatePath('/expenses/categories')
}
