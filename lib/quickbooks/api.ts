import type { QboConnection } from '@/lib/supabase/types/database'
import { qboJson, QboError } from './client'

/** Minimal shapes for the QBO entities we touch. */
export type QboRef = { value: string; name?: string }
export type QboAccount = {
  Id: string
  Name: string
  FullyQualifiedName: string
  AccountType: string
  Active: boolean
}
export type QboClass = { Id: string; Name: string; Active: boolean }
export type QboVendor = { Id: string; DisplayName: string; SyncToken: string }
export type QboPurchase = {
  Id: string
  SyncToken: string
  TxnDate?: string
  TotalAmt?: number
  PaymentType?: string
  Line?: unknown[]
}

type QueryResponse<K extends string, T> = {
  QueryResponse: { [key in K]?: T[] } & { maxResults?: number }
}

/** Escape a string literal for the QBO query language. */
function q(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

async function query<K extends string, T>(
  conn: QboConnection,
  key: K,
  sql: string
): Promise<T[]> {
  const res = await qboJson<QueryResponse<K, T>>(
    conn,
    `query?query=${encodeURIComponent(sql)}`
  )
  return res.QueryResponse[key] ?? []
}

/** Expense-type accounts, for mapping our categories to the chart of accounts. */
export async function listExpenseAccounts(conn: QboConnection): Promise<QboAccount[]> {
  return query<'Account', QboAccount>(
    conn,
    'Account',
    "select Id, Name, FullyQualifiedName, AccountType, Active from Account where AccountType in ('Expense', 'Other Expense', 'Cost of Goods Sold') and Active = true maxresults 1000"
  )
}

/** Bank / credit-card / liability accounts money can be paid from. */
export async function listPaymentAccounts(conn: QboConnection): Promise<QboAccount[]> {
  return query<'Account', QboAccount>(
    conn,
    'Account',
    "select Id, Name, FullyQualifiedName, AccountType, Active from Account where AccountType in ('Bank', 'Credit Card', 'Other Current Liability') and Active = true maxresults 1000"
  )
}

export async function listClasses(conn: QboConnection): Promise<QboClass[]> {
  return query<'Class', QboClass>(
    conn,
    'Class',
    'select Id, Name, Active from Class where Active = true maxresults 1000'
  )
}

export async function getCompanyName(conn: QboConnection): Promise<string | null> {
  try {
    const res = await qboJson<{ CompanyInfo?: { CompanyName?: string } }>(
      conn,
      `companyinfo/${conn.realm_id}`
    )
    return res.CompanyInfo?.CompanyName ?? null
  } catch {
    return null
  }
}

export async function findVendorByName(
  conn: QboConnection,
  displayName: string
): Promise<QboVendor | null> {
  const vendors = await query<'Vendor', QboVendor>(
    conn,
    'Vendor',
    `select Id, DisplayName, SyncToken from Vendor where DisplayName = '${q(displayName)}'`
  )
  return vendors[0] ?? null
}

export async function createVendor(
  conn: QboConnection,
  vendor: { DisplayName: string; Vendor1099?: boolean }
): Promise<QboVendor> {
  const res = await qboJson<{ Vendor: QboVendor }>(conn, 'vendor', {
    method: 'POST',
    body: JSON.stringify(vendor),
  })
  return res.Vendor
}

export async function getPurchase(conn: QboConnection, id: string): Promise<QboPurchase | null> {
  try {
    const res = await qboJson<{ Purchase: QboPurchase }>(conn, `purchase/${id}`)
    return res.Purchase
  } catch (error) {
    // A deleted/never-existed purchase comes back as an error; treat as absent
    // so the caller re-creates it rather than failing the sync forever.
    if (error instanceof QboError) return null
    throw error
  }
}

export async function createPurchase(
  conn: QboConnection,
  purchase: Record<string, unknown>
): Promise<QboPurchase> {
  const res = await qboJson<{ Purchase: QboPurchase }>(conn, 'purchase', {
    method: 'POST',
    body: JSON.stringify(purchase),
  })
  return res.Purchase
}

export async function updatePurchase(
  conn: QboConnection,
  purchase: Record<string, unknown> & { Id: string; SyncToken: string }
): Promise<QboPurchase> {
  const res = await qboJson<{ Purchase: QboPurchase }>(conn, 'purchase', {
    method: 'POST',
    body: JSON.stringify({ ...purchase, sparse: true }),
  })
  return res.Purchase
}

export async function deletePurchase(conn: QboConnection, id: string): Promise<void> {
  const existing = await getPurchase(conn, id)
  if (!existing) return
  await qboJson(conn, 'purchase?operation=delete', {
    method: 'POST',
    body: JSON.stringify({ Id: existing.Id, SyncToken: existing.SyncToken }),
  })
}

/**
 * Upload a file and attach it to a Purchase. QBO's upload endpoint takes
 * multipart form data with a JSON metadata part and the file content part.
 */
export async function attachFileToPurchase(
  conn: QboConnection,
  purchaseId: string,
  file: { name: string; contentType: string; bytes: Uint8Array }
): Promise<void> {
  const metadata = {
    AttachableRef: [{ EntityRef: { type: 'Purchase', value: purchaseId } }],
    FileName: file.name,
    ContentType: file.contentType,
  }
  const form = new FormData()
  form.append(
    'file_metadata_01',
    new Blob([JSON.stringify(metadata)], { type: 'application/json' }),
    'attachment.json'
  )
  form.append(
    'file_content_01',
    new Blob([file.bytes as BlobPart], { type: file.contentType }),
    file.name
  )
  await qboJson(conn, 'upload', { method: 'POST', body: form })
}
