import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  Database,
  Expense,
  ExpensePaymentMethod,
  QboMapping,
} from '@/lib/supabase/types/database'
import { createAdminClient } from '@/lib/supabase/admin'
import { isDemoMode } from '@/lib/supabase/demo/mock-client'
import { getValidConnection, QboError } from './client'
import {
  attachFileToPurchase,
  createPurchase,
  createVendor,
  deletePurchase,
  findVendorByName,
  getPurchase,
  updatePurchase,
} from './api'

/**
 * One-way push of a bio_expenses row to QuickBooks as a Purchase.
 *
 * Never throws: the expense save must succeed whether or not QuickBooks is
 * reachable. Failures land in qbo_sync_status='failed' + qbo_sync_error and
 * can be retried from the expense page. When no company is connected the
 * expense is left as not_synced and skipped silently.
 */
export async function syncExpenseToQbo(
  supabase: SupabaseClient<Database>,
  expenseId: string
): Promise<{ ok: boolean; error?: string }> {
  if (isDemoMode()) return { ok: true }

  let conn
  try {
    conn = await getValidConnection()
  } catch (error) {
    const message = error instanceof Error ? error.message : 'QuickBooks connection error'
    await recordFailure(supabase, expenseId, message)
    return { ok: false, error: message }
  }
  if (!conn) return { ok: true } // not connected — nothing to do

  try {
    const { data: expense } = await supabase
      .from('bio_expenses')
      .select('*')
      .eq('id', expenseId)
      .maybeSingle()
    if (!expense) throw new QboError('Expense not found')

    const [{ data: category }, { data: vendor }] = await Promise.all([
      supabase
        .from('bio_expense_categories')
        .select('id, name, functional_class')
        .eq('id', expense.category_id)
        .maybeSingle(),
      expense.vendor_contact_id
        ? supabase
            .from('bio_contacts')
            .select('id, display_name, qbo_vendor_id')
            .eq('id', expense.vendor_contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ])

    const mappings = await loadMappings(supabase)
    const purchaseBody = await buildPurchaseBody(
      supabase,
      conn,
      { ...expense, category: category ?? null, vendor: vendor ?? null },
      mappings
    )

    let purchaseId = expense.qbo_purchase_id
    let created = false
    if (purchaseId) {
      const existing = await getPurchase(conn, purchaseId)
      if (existing) {
        await updatePurchase(conn, {
          ...purchaseBody,
          Id: existing.Id,
          SyncToken: existing.SyncToken,
        })
      } else {
        purchaseId = null // was deleted in QBO; re-create below
      }
    }
    if (!purchaseId) {
      const purchase = await createPurchase(conn, purchaseBody)
      purchaseId = purchase.Id
      created = true
    }

    if (created) {
      await attachReceipts(conn, expenseId, purchaseId)
    }

    await supabase
      .from('bio_expenses')
      .update({
        qbo_purchase_id: purchaseId,
        qbo_sync_status: 'synced',
        qbo_synced_at: new Date().toISOString(),
        qbo_sync_error: null,
      })
      .eq('id', expenseId)
    return { ok: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown QuickBooks sync error'
    await recordFailure(supabase, expenseId, message)
    return { ok: false, error: message }
  }
}

/** Best-effort delete of the QBO Purchase when an expense is deleted locally. */
export async function deleteExpenseFromQbo(qboPurchaseId: string): Promise<void> {
  if (isDemoMode()) return
  try {
    const conn = await getValidConnection()
    if (!conn) return
    await deletePurchase(conn, qboPurchaseId)
  } catch {
    // The local delete proceeds either way; the accountant reconciles QBO.
  }
}

async function recordFailure(
  supabase: SupabaseClient<Database>,
  expenseId: string,
  message: string
): Promise<void> {
  await supabase
    .from('bio_expenses')
    .update({ qbo_sync_status: 'failed', qbo_sync_error: message.slice(0, 1000) })
    .eq('id', expenseId)
}

type MappingIndex = Map<string, QboMapping>

async function loadMappings(supabase: SupabaseClient<Database>): Promise<MappingIndex> {
  const { data } = await supabase.from('bio_qbo_mappings').select('*')
  const index: MappingIndex = new Map()
  for (const m of data ?? []) index.set(`${m.mapping_type}:${m.local_key}`, m)
  return index
}

const PAYMENT_TYPE: Record<ExpensePaymentMethod, string> = {
  card: 'CreditCard',
  check: 'Check',
  ach: 'Cash',
  wire: 'Cash',
  reimbursement: 'Cash',
}

type ExpenseWithJoins = Expense & {
  category: { id: string; name: string; functional_class: string } | null
  vendor: { id: string; display_name: string; qbo_vendor_id: string | null } | null
}

async function buildPurchaseBody(
  supabase: SupabaseClient<Database>,
  conn: NonNullable<Awaited<ReturnType<typeof getValidConnection>>>,
  expense: ExpenseWithJoins,
  mappings: MappingIndex
): Promise<Record<string, unknown>> {
  if (!expense.category) throw new QboError('Expense has no category')

  const categoryMapping = mappings.get(`category:${expense.category.id}`)
  if (!categoryMapping) {
    throw new QboError(
      `Category "${expense.category.name}" is not mapped to a QuickBooks account. Map it in Settings → QuickBooks.`
    )
  }

  const paymentAccount =
    (expense.payment_method && mappings.get(`payment_method:${expense.payment_method}`)) ||
    mappings.get('payment_method:_default')
  if (!paymentAccount) {
    throw new QboError(
      expense.payment_method
        ? `Payment method "${expense.payment_method}" has no QuickBooks payment account. Map it in Settings → QuickBooks.`
        : 'Set a default payment account in Settings → QuickBooks (expense has no payment method).'
    )
  }

  const classMapping = mappings.get(`functional_class:${expense.category.functional_class}`)

  const line: Record<string, unknown> = {
    Amount: centsToAmount(expense.amount_cents),
    DetailType: 'AccountBasedExpenseLineDetail',
    Description: expense.description,
    AccountBasedExpenseLineDetail: {
      AccountRef: { value: categoryMapping.qbo_id },
      ...(classMapping ? { ClassRef: { value: classMapping.qbo_id } } : {}),
    },
  }

  const body: Record<string, unknown> = {
    TxnDate: expense.expense_date,
    PaymentType: expense.payment_method ? PAYMENT_TYPE[expense.payment_method] : 'Cash',
    AccountRef: { value: paymentAccount.qbo_id },
    Line: [line],
    PrivateNote: [`SAIF Bio expense ${expense.id}`, expense.notes]
      .filter(Boolean)
      .join(' — ')
      .slice(0, 4000),
  }

  if (expense.vendor) {
    const vendorId = await ensureVendor(supabase, conn, expense.vendor, expense.is_1099_eligible)
    body.EntityRef = { value: vendorId, type: 'Vendor' }
  }

  return body
}

async function ensureVendor(
  supabase: SupabaseClient<Database>,
  conn: NonNullable<Awaited<ReturnType<typeof getValidConnection>>>,
  vendor: { id: string; display_name: string; qbo_vendor_id: string | null },
  is1099Eligible: boolean
): Promise<string> {
  if (vendor.qbo_vendor_id) return vendor.qbo_vendor_id

  const existing = await findVendorByName(conn, vendor.display_name)
  const qboVendor =
    existing ??
    (await createVendor(conn, {
      DisplayName: vendor.display_name,
      ...(is1099Eligible ? { Vendor1099: true } : {}),
    }))

  await supabase
    .from('bio_contacts')
    .update({ qbo_vendor_id: qboVendor.Id })
    .eq('id', vendor.id)
  return qboVendor.Id
}

/** Attach the expense's receipt files to the newly created Purchase. */
async function attachReceipts(
  conn: NonNullable<Awaited<ReturnType<typeof getValidConnection>>>,
  expenseId: string,
  purchaseId: string
): Promise<void> {
  const admin = createAdminClient()
  const { data: attachments } = await admin
    .from('bio_attachments')
    .select('storage_path, file_name, mime_type')
    .eq('entity_type', 'expense')
    .eq('entity_id', expenseId)

  for (const attachment of attachments ?? []) {
    try {
      const { data: blob } = await admin.storage
        .from('documents')
        .download(attachment.storage_path)
      if (!blob) continue
      await attachFileToPurchase(conn, purchaseId, {
        name: attachment.file_name,
        contentType: attachment.mime_type ?? 'application/octet-stream',
        bytes: new Uint8Array(await blob.arrayBuffer()),
      })
    } catch {
      // Receipts are nice-to-have on the QBO side; the transaction itself synced.
    }
  }
}

function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2))
}
