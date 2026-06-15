import { Fragment } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import PageHeader from '@/components/PageHeader'
import { formatCents } from '@/lib/utils/money'
import { currentFiscalYear, fiscalYearRange } from '@/lib/utils/fiscal-year'
import type { FunctionalClass } from '@/lib/supabase/types/database'

const FUNCTIONAL_CLASS_ORDER: FunctionalClass[] = ['program', 'management_general', 'fundraising']

const FUNCTIONAL_CLASS_LABELS: Record<FunctionalClass, string> = {
  program: 'Program',
  management_general: 'Management & general',
  fundraising: 'Fundraising',
}

function SectionHeader({ title, csvHref }: { title: string; csvHref: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="font-medium text-gray-900">{title}</h2>
      <a href={csvHref} className="text-xs text-gray-500 hover:text-gray-900 underline">
        Download CSV
      </a>
    </div>
  )
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ fy?: string }>
}) {
  const { fy: fyParam } = await searchParams
  const supabase = await createClient()

  const { data: settings } = await supabase
    .from('bio_settings')
    .select('fiscal_year_start_month')
    .eq('id', 1)
    .maybeSingle()

  const startMonth = settings?.fiscal_year_start_month ?? 1
  const current = currentFiscalYear(startMonth)
  const parsed = Number(fyParam)
  const fy = Number.isInteger(parsed) && parsed > 1900 && parsed < 3000 ? parsed : current
  const { start, end } = fiscalYearRange(fy, startMonth)
  const fyOptions = [current, current - 1, current - 2]

  const [expensesRes, categoriesRes, contributionsRes, disbursementsRes] = await Promise.all([
    supabase
      .from('bio_expenses')
      .select('id, amount_cents, category_id, is_1099_eligible, vendor_contact_id')
      .gte('expense_date', start)
      .lt('expense_date', end),
    supabase.from('bio_expense_categories').select('id, name, functional_class, form_990_line'),
    supabase
      .from('bio_contributions')
      .select('id, contact_id, amount_cents, method, restriction')
      .gte('received_date', start)
      .lt('received_date', end),
    supabase
      .from('bio_disbursements')
      .select('grant_out_id, amount_cents')
      .eq('status', 'paid')
      .gte('paid_date', start)
      .lt('paid_date', end),
  ])

  const expenses = expensesRes.data ?? []
  const categories = categoriesRes.data ?? []
  const contributions = contributionsRes.data ?? []
  const disbursements = disbursementsRes.data ?? []

  // --- Grants paid grouping (need grants-out details) ---
  const paidByGrant = new Map<string, number>()
  for (const d of disbursements) {
    paidByGrant.set(d.grant_out_id, (paidByGrant.get(d.grant_out_id) ?? 0) + d.amount_cents)
  }
  const grantOutIds = Array.from(paidByGrant.keys())
  const { data: grantsOutData } =
    grantOutIds.length > 0
      ? await supabase
          .from('bio_grants_out')
          .select('id, grantee_contact_id, purpose')
          .in('id', grantOutIds)
      : { data: [] as { id: string; grantee_contact_id: string; purpose: string | null }[] }
  const grantsOut = grantsOutData ?? []

  // --- Contacts for donors, grantees, and 1099 vendors ---
  const eligible1099 = expenses.filter((e) => e.is_1099_eligible)
  const contactIds = Array.from(
    new Set([
      ...contributions.map((c) => c.contact_id),
      ...grantsOut.map((g) => g.grantee_contact_id),
      ...eligible1099.flatMap((e) => (e.vendor_contact_id ? [e.vendor_contact_id] : [])),
    ])
  )
  const { data: contactsData } =
    contactIds.length > 0
      ? await supabase
          .from('bio_contacts')
          .select('id, display_name, tax_id, w9_on_file')
          .in('id', contactIds)
      : {
          data: [] as {
            id: string
            display_name: string
            tax_id: string | null
            w9_on_file: boolean
          }[],
        }
  const contactById = new Map((contactsData ?? []).map((c) => [c.id, c]))

  // --- Functional expenses ---
  const totalsByCategory = new Map<string, number>()
  for (const e of expenses) {
    totalsByCategory.set(e.category_id, (totalsByCategory.get(e.category_id) ?? 0) + e.amount_cents)
  }
  const expenseClasses = FUNCTIONAL_CLASS_ORDER.map((fc) => {
    const rows = categories
      .filter((c) => c.functional_class === fc && totalsByCategory.has(c.id))
      .map((c) => ({ category: c, total: totalsByCategory.get(c.id) ?? 0 }))
      .sort((a, b) => a.category.name.localeCompare(b.category.name))
    return { fc, rows, subtotal: rows.reduce((sum, r) => sum + r.total, 0) }
  }).filter((group) => group.rows.length > 0)
  const expensesGrandTotal = expenses.reduce((sum, e) => sum + e.amount_cents, 0)

  // --- Contributions summary ---
  const cashGifts = contributions.filter(
    (c) => c.method !== 'in_kind' && c.method !== 'stock' && c.amount_cents !== null
  )
  const stockGifts = contributions.filter((c) => c.method === 'stock')
  const inKindCount = contributions.filter((c) => c.method === 'in_kind').length
  const totalCash = cashGifts.reduce((sum, c) => sum + (c.amount_cents ?? 0), 0)
  const stockFmv = stockGifts.reduce((sum, c) => sum + (c.amount_cents ?? 0), 0)
  const restrictedCash = cashGifts
    .filter((c) => c.restriction === 'donor_restricted')
    .reduce((sum, c) => sum + (c.amount_cents ?? 0), 0)
  const unrestrictedCash = totalCash - restrictedCash

  const byDonor = new Map<string, { gifts: number; total: number }>()
  for (const c of contributions) {
    const entry = byDonor.get(c.contact_id) ?? { gifts: 0, total: 0 }
    entry.gifts += 1
    if (c.method !== 'in_kind' && c.amount_cents !== null) entry.total += c.amount_cents
    byDonor.set(c.contact_id, entry)
  }
  const donorRows = Array.from(byDonor.entries())
    .map(([contactId, stats]) => ({
      name: contactById.get(contactId)?.display_name ?? 'Unknown donor',
      ...stats,
    }))
    .sort((a, b) => b.total - a.total)

  // --- Grants paid rows ---
  const grantsPaidRows = grantsOut
    .map((g) => {
      const grantee = contactById.get(g.grantee_contact_id)
      return {
        id: g.id,
        grantee: grantee?.display_name ?? 'Unknown grantee',
        ein: grantee?.tax_id ?? '—',
        purpose: g.purpose ?? '—',
        amount: paidByGrant.get(g.id) ?? 0,
      }
    })
    .sort((a, b) => b.amount - a.amount)
  const grantsPaidTotal = grantsPaidRows.reduce((sum, r) => sum + r.amount, 0)

  // --- 1099 vendors ---
  const byVendor = new Map<string, number>()
  for (const e of eligible1099) {
    const key = e.vendor_contact_id ?? ''
    byVendor.set(key, (byVendor.get(key) ?? 0) + e.amount_cents)
  }
  const vendorRows = Array.from(byVendor.entries())
    .map(([vendorId, total]) => {
      const vendor = vendorId ? contactById.get(vendorId) : undefined
      return {
        id: vendorId || 'none',
        name: vendor?.display_name ?? '(No vendor recorded)',
        w9: vendorId ? (vendor?.w9_on_file ?? false) : null,
        total,
      }
    })
    .sort((a, b) => b.total - a.total)

  const headerCell = 'py-2 pr-4 font-medium'
  const headerRow =
    'text-left text-xs text-gray-500 uppercase tracking-wide border-b border-gray-100'
  const bodyRow = 'border-b border-gray-50 hover:bg-gray-50'

  return (
    <div>
      <PageHeader title="Reports" description={`Fiscal year ${fy} · ${start} to ${end}`}>
        <div className="flex items-center gap-1">
          {fyOptions.map((option) => (
            <Link
              key={option}
              href={`/reports?fy=${option}`}
              className={`px-3 py-1.5 rounded-lg text-sm ${
                option === fy
                  ? 'bg-gray-900 text-white font-medium'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              FY{option}
            </Link>
          ))}
        </div>
      </PageHeader>

      <div className="space-y-6">
        {/* Functional expenses */}
        <div className="card p-6">
          <SectionHeader title="Functional expenses" csvHref={`/api/exports/expenses?fy=${fy}`} />
          {expenseClasses.length === 0 ? (
            <p className="text-sm text-gray-400">No expenses recorded for this fiscal year.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={headerRow}>
                  <th className={headerCell}>Category</th>
                  <th className={headerCell}>990 line</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {expenseClasses.map(({ fc, rows, subtotal }) => (
                  <Fragment key={fc}>
                    {rows.map(({ category, total }) => (
                      <tr key={category.id} className={bodyRow}>
                        <td className="py-2.5 pr-4 text-gray-900">{category.name}</td>
                        <td className="py-2.5 pr-4 text-gray-500">
                          {category.form_990_line ?? '—'}
                        </td>
                        <td className="py-2.5 text-right tabular-nums">{formatCents(total)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <td className="py-2 pr-4 text-gray-600 font-medium" colSpan={2}>
                        {FUNCTIONAL_CLASS_LABELS[fc]} subtotal
                      </td>
                      <td className="py-2 text-right tabular-nums font-medium">
                        {formatCents(subtotal)}
                      </td>
                    </tr>
                  </Fragment>
                ))}
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-gray-900" colSpan={2}>
                    Total expenses
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold">
                    {formatCents(expensesGrandTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* Contributions */}
        <div className="card p-6">
          <SectionHeader title="Contributions" csvHref={`/api/exports/contributions?fy=${fy}`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Total cash</p>
              <p className="text-lg font-semibold tabular-nums">{formatCents(totalCash)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Cash gifts</p>
              <p className="text-lg font-semibold tabular-nums">{cashGifts.length}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Stock FMV</p>
              <p className="text-lg font-semibold tabular-nums">{formatCents(stockFmv)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">In-kind gifts</p>
              <p className="text-lg font-semibold tabular-nums">{inKindCount}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Unrestricted</p>
              <p className="text-lg font-semibold tabular-nums">{formatCents(unrestrictedCash)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Restricted</p>
              <p className="text-lg font-semibold tabular-nums">{formatCents(restrictedCash)}</p>
            </div>
          </div>
          {donorRows.length === 0 ? (
            <p className="text-sm text-gray-400">No contributions recorded for this fiscal year.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={headerRow}>
                  <th className={headerCell}>Donor</th>
                  <th className="py-2 pr-4 font-medium text-right"># gifts</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {donorRows.map((row) => (
                  <tr key={row.name} className={bodyRow}>
                    <td className="py-2.5 pr-4 text-gray-900">{row.name}</td>
                    <td className="py-2.5 pr-4 text-right tabular-nums">{row.gifts}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatCents(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Grants paid */}
        <div className="card p-6">
          <SectionHeader
            title="Grants paid (990 Schedule I)"
            csvHref={`/api/exports/grants-paid?fy=${fy}`}
          />
          {grantsPaidRows.length === 0 ? (
            <p className="text-sm text-gray-400">No grants paid in this fiscal year.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={headerRow}>
                  <th className={headerCell}>Grantee</th>
                  <th className={headerCell}>EIN</th>
                  <th className={headerCell}>Purpose</th>
                  <th className="py-2 font-medium text-right">Amount disbursed</th>
                </tr>
              </thead>
              <tbody>
                {grantsPaidRows.map((row) => (
                  <tr key={row.id} className={bodyRow}>
                    <td className="py-2.5 pr-4 text-gray-900">{row.grantee}</td>
                    <td className="py-2.5 pr-4 text-gray-500">{row.ein}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{row.purpose}</td>
                    <td className="py-2.5 text-right tabular-nums">{formatCents(row.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="py-2.5 pr-4 font-semibold text-gray-900" colSpan={3}>
                    Total
                  </td>
                  <td className="py-2.5 text-right tabular-nums font-semibold">
                    {formatCents(grantsPaidTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* 1099 vendors */}
        <div className="card p-6">
          <SectionHeader title="1099 vendors" csvHref={`/api/exports/1099-vendors?fy=${fy}`} />
          {vendorRows.length === 0 ? (
            <p className="text-sm text-gray-400">
              No 1099-eligible expenses recorded for this fiscal year.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className={headerRow}>
                  <th className={headerCell}>Vendor</th>
                  <th className={headerCell}>W-9 on file</th>
                  <th className="py-2 font-medium text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {vendorRows.map((row) => (
                  <tr key={row.id} className={bodyRow}>
                    <td className="py-2.5 pr-4 text-gray-900">{row.name}</td>
                    <td className="py-2.5 pr-4">
                      {row.w9 === null ? (
                        <span className="text-gray-400">—</span>
                      ) : row.w9 ? (
                        <span className="text-green-700">Yes</span>
                      ) : (
                        <span className="text-red-600">No</span>
                      )}
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatCents(row.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-400 mt-3">
            Vendors paid over $600 in the fiscal year need a Form 1099.
          </p>
        </div>
      </div>
    </div>
  )
}
