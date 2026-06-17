import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { currentFiscalYear, fiscalYearRange } from '@/lib/utils/fiscal-year'

const REPORTS = new Set(['expenses', 'contributions', 'grants-paid', '1099-vendors'])

function escapeCsv(value: string | number | boolean | null | undefined): string {
  const s = value === null || value === undefined ? '' : String(value)
  return `"${s.replace(/"/g, '""')}"`
}

/** Integer cents -> decimal dollar string with 2dp, '' for null */
function dollars(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return ''
  return (cents / 100).toFixed(2)
}

/** Like dollars() but keeps sub-cent precision (per-share prices stored as numeric). */
function perShareDollars(cents: number | string | null | undefined): string {
  if (cents === null || cents === undefined || cents === '') return ''
  const n = typeof cents === 'string' ? Number(cents) : cents
  if (!Number.isFinite(n)) return ''
  return String(Number((n / 100).toFixed(6)))
}

function toCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  return [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n') + '\n'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ report: string }> }
) {
  const { report } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (!REPORTS.has(report)) {
    return NextResponse.json({ error: 'Unknown report' }, { status: 404 })
  }

  const { data: settings } = await supabase
    .from('bio_settings')
    .select('fiscal_year_start_month')
    .eq('id', 1)
    .maybeSingle()
  const startMonth = settings?.fiscal_year_start_month ?? 1

  const fyParam = Number(request.nextUrl.searchParams.get('fy'))
  const fy =
    Number.isInteger(fyParam) && fyParam > 1900 && fyParam < 3000
      ? fyParam
      : currentFiscalYear(startMonth)
  const { start, end } = fiscalYearRange(fy, startMonth)

  let csv: string

  switch (report) {
    case 'expenses': {
      const [expensesRes, categoriesRes] = await Promise.all([
        supabase
          .from('bio_expenses')
          .select('expense_date, description, amount_cents, category_id, vendor_contact_id, status')
          .gte('expense_date', start)
          .lt('expense_date', end)
          .order('expense_date'),
        supabase.from('bio_expense_categories').select('id, name, functional_class'),
      ])
      const expenses = expensesRes.data ?? []
      const categoryById = new Map((categoriesRes.data ?? []).map((c) => [c.id, c]))

      const vendorIds = Array.from(
        new Set(expenses.flatMap((e) => (e.vendor_contact_id ? [e.vendor_contact_id] : [])))
      )
      const { data: vendors } =
        vendorIds.length > 0
          ? await supabase.from('bio_contacts').select('id, display_name').in('id', vendorIds)
          : { data: [] as { id: string; display_name: string }[] }
      const vendorName = new Map((vendors ?? []).map((v) => [v.id, v.display_name]))

      csv = toCsv(
        ['date', 'description', 'category', 'functional_class', 'vendor', 'status', 'amount'],
        expenses.map((e) => {
          const category = categoryById.get(e.category_id)
          return [
            e.expense_date,
            e.description,
            category?.name ?? '',
            category?.functional_class ?? '',
            e.vendor_contact_id ? (vendorName.get(e.vendor_contact_id) ?? '') : '',
            e.status,
            dollars(e.amount_cents),
          ]
        })
      )
      break
    }

    case 'contributions': {
      const { data: contributionsData } = await supabase
        .from('bio_contributions')
        .select('id, received_date, contact_id, amount_cents, method, restriction, quid_pro_quo')
        .gte('received_date', start)
        .lt('received_date', end)
        .order('received_date')
      const contributions = contributionsData ?? []

      const donorIds = Array.from(new Set(contributions.map((c) => c.contact_id)))
      const { data: donors } =
        donorIds.length > 0
          ? await supabase.from('bio_contacts').select('id, display_name').in('id', donorIds)
          : { data: [] as { id: string; display_name: string }[] }
      const donorName = new Map((donors ?? []).map((d) => [d.id, d.display_name]))

      const stockContributionIds = contributions
        .filter((c) => c.method === 'stock')
        .map((c) => c.id)
      const { data: stockDetails } =
        stockContributionIds.length > 0
          ? await supabase
              .from('bio_stock_contribution_details')
              .select('*')
              .in('contribution_id', stockContributionIds)
          : { data: [] }
      const stockByContribution = new Map(
        (stockDetails ?? []).map((detail) => [detail.contribution_id, detail])
      )

      csv = toCsv(
        [
          'date',
          'donor',
          'amount_or_internal_fmv',
          'method',
          'restriction',
          'quid_pro_quo',
          'security',
          'ticker',
          'shares',
          'valuation_date',
          'fmv_per_share',
          'valuation_source',
          'sale_date',
          'sale_net',
        ],
        contributions.map((c) => {
          const stock = stockByContribution.get(c.id)
          return [
            c.received_date,
            donorName.get(c.contact_id) ?? '',
            dollars(c.amount_cents),
            c.method,
            c.restriction,
            c.quid_pro_quo ? 'yes' : 'no',
            stock?.security_name ?? '',
            stock?.ticker_symbol ?? '',
            stock?.shares ?? '',
            stock?.valuation_date ?? '',
            perShareDollars(stock?.fmv_per_share_cents),
            stock?.valuation_source ?? '',
            stock?.sale_date ?? '',
            dollars(stock?.sale_net_cents),
          ]
        })
      )
      break
    }

    case 'grants-paid': {
      const { data: disbursementsData } = await supabase
        .from('bio_disbursements')
        .select('grant_out_id, amount_cents')
        .eq('status', 'paid')
        .gte('paid_date', start)
        .lt('paid_date', end)
      const disbursements = disbursementsData ?? []

      const paidByGrant = new Map<string, number>()
      for (const d of disbursements) {
        paidByGrant.set(d.grant_out_id, (paidByGrant.get(d.grant_out_id) ?? 0) + d.amount_cents)
      }
      const grantIds = Array.from(paidByGrant.keys())
      const { data: grantsData } =
        grantIds.length > 0
          ? await supabase
              .from('bio_grants_out')
              .select('id, grantee_contact_id, purpose, award_date')
              .in('id', grantIds)
          : {
              data: [] as {
                id: string
                grantee_contact_id: string
                purpose: string | null
                award_date: string | null
              }[],
            }
      const grants = grantsData ?? []

      const granteeIds = Array.from(new Set(grants.map((g) => g.grantee_contact_id)))
      const { data: grantees } =
        granteeIds.length > 0
          ? await supabase
              .from('bio_contacts')
              .select('id, display_name, tax_id')
              .in('id', granteeIds)
          : { data: [] as { id: string; display_name: string; tax_id: string | null }[] }
      const granteeById = new Map((grantees ?? []).map((g) => [g.id, g]))

      csv = toCsv(
        ['grantee', 'ein', 'purpose', 'award_date', 'amount_disbursed_in_fy'],
        grants
          .map((g) => {
            const grantee = granteeById.get(g.grantee_contact_id)
            return {
              row: [
                grantee?.display_name ?? '',
                grantee?.tax_id ?? '',
                g.purpose ?? '',
                g.award_date ?? '',
                dollars(paidByGrant.get(g.id) ?? 0),
              ],
              amount: paidByGrant.get(g.id) ?? 0,
            }
          })
          .sort((a, b) => b.amount - a.amount)
          .map((entry) => entry.row)
      )
      break
    }

    default: {
      // '1099-vendors'
      const { data: expensesData } = await supabase
        .from('bio_expenses')
        .select('amount_cents, vendor_contact_id')
        .eq('is_1099_eligible', true)
        .gte('expense_date', start)
        .lt('expense_date', end)
      const expenses = expensesData ?? []

      const byVendor = new Map<string, number>()
      for (const e of expenses) {
        const key = e.vendor_contact_id ?? ''
        byVendor.set(key, (byVendor.get(key) ?? 0) + e.amount_cents)
      }
      const vendorIds = Array.from(byVendor.keys()).filter((id) => id !== '')
      const { data: vendors } =
        vendorIds.length > 0
          ? await supabase
              .from('bio_contacts')
              .select('id, display_name, tax_id, w9_on_file')
              .in('id', vendorIds)
          : {
              data: [] as {
                id: string
                display_name: string
                tax_id: string | null
                w9_on_file: boolean
              }[],
            }
      const vendorById = new Map((vendors ?? []).map((v) => [v.id, v]))

      csv = toCsv(
        ['vendor', 'ein', 'w9_on_file', 'total'],
        Array.from(byVendor.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([vendorId, total]) => {
            const vendor = vendorId ? vendorById.get(vendorId) : undefined
            return [
              vendor?.display_name ?? '(No vendor recorded)',
              vendor?.tax_id ?? '',
              vendorId ? (vendor?.w9_on_file ? 'yes' : 'no') : '',
              dollars(total),
            ]
          })
      )
      break
    }
  }

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${report}-fy${fy}.csv"`,
    },
  })
}
