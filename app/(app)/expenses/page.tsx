import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import StatusBadge from '@/components/StatusBadge'
import EmptyState from '@/components/EmptyState'
import { formatCents } from '@/lib/utils/money'
import { formatDate } from '@/lib/utils/dates'
import { FUNCTIONAL_CLASS_LABELS, FUNCTIONAL_CLASS_ORDER } from './functional-class'
import type { FunctionalClass } from '@/lib/supabase/types/database'

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category: categoryFilter } = await searchParams
  const supabase = await createClient()

  const [{ data: expenses }, { data: categories }, { data: vendors }] = await Promise.all([
    supabase.from('bio_expenses').select('*').order('expense_date', { ascending: false }),
    supabase.from('bio_expense_categories').select('*').order('name'),
    supabase.from('bio_contacts').select('id, display_name').eq('is_vendor', true),
  ])

  const allExpenses = expenses ?? []
  const allCategories = categories ?? []
  const categoryMap = new Map(allCategories.map((c) => [c.id, c]))
  const vendorMap = new Map((vendors ?? []).map((v) => [v.id, v.display_name]))

  // YTD summary for the current calendar year (unaffected by the category filter)
  const yearPrefix = `${new Date().getFullYear()}-`
  const ytdExpenses = allExpenses.filter((e) => e.expense_date.startsWith(yearPrefix))
  const ytdTotal = ytdExpenses.reduce((sum, e) => sum + e.amount_cents, 0)
  const ytdByClass: Record<FunctionalClass, number> = {
    program: 0,
    management_general: 0,
    fundraising: 0,
  }
  for (const e of ytdExpenses) {
    const fc = categoryMap.get(e.category_id)?.functional_class
    if (fc) ytdByClass[fc] += e.amount_cents
  }

  const filtered = categoryFilter
    ? allExpenses.filter((e) => e.category_id === categoryFilter)
    : allExpenses

  return (
    <div>
      <PageHeader
        title="Expenses"
        description="Operating expenses tracked for Form 990 functional reporting."
        action={{ href: '/expenses/new', label: 'New expense' }}
      >
        <Link href="/expenses/import" className="btn btn-secondary">
          Import invoice
        </Link>
        <Link href="/expenses/categories" className="btn btn-secondary">
          Manage categories
        </Link>
      </PageHeader>

      <div className="card p-5 mb-6">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">YTD total</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
              {formatCents(ytdTotal)}
            </p>
          </div>
          {FUNCTIONAL_CLASS_ORDER.map((fc) => (
            <div key={fc}>
              <p className="text-xs text-gray-500 uppercase tracking-wide">
                {FUNCTIONAL_CLASS_LABELS[fc]}
              </p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums mt-1">
                {formatCents(ytdByClass[fc])}
              </p>
            </div>
          ))}
        </div>
      </div>

      {allCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Link
            href="/expenses"
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
              !categoryFilter
                ? 'bg-gray-900 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            All
          </Link>
          {allCategories.map((c) => (
            <Link
              key={c.id}
              href={`/expenses?category=${c.id}`}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                categoryFilter === c.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState
          message={
            categoryFilter ? 'No expenses in this category yet.' : 'No expenses recorded yet.'
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {formatDate(e.expense_date)}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/expenses/${e.id}`}
                      className="font-medium text-gray-900 hover:underline"
                    >
                      {e.description}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {categoryMap.get(e.category_id)?.name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {e.vendor_contact_id ? vendorMap.get(e.vendor_contact_id) ?? '—' : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                    {formatCents(e.amount_cents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
