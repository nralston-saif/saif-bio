'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requireMemberId, ActionError } from './helpers'
import { disconnect } from '@/lib/quickbooks/client'
import { syncExpenseToQbo } from '@/lib/quickbooks/sync'
import type { QboMappingType } from '@/lib/supabase/types/database'

export async function disconnectQuickBooks() {
  await requireMemberId()
  await disconnect()
  revalidatePath('/settings')
}

/**
 * Saves the QuickBooks entity mappings from the settings form. Fields are
 * named `map:<mapping_type>:<local_key>` with value `<qbo_id>::<qbo_name>`
 * (empty value clears the mapping).
 */
export async function saveQboMappings(formData: FormData) {
  await requireMemberId()
  const supabase = await createClient()

  const MAPPING_TYPES: QboMappingType[] = ['category', 'functional_class', 'payment_method']

  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('map:') || typeof value !== 'string') continue
    const [, rawType, localKey] = key.split(':')
    const mappingType = MAPPING_TYPES.find((t) => t === rawType)
    if (!mappingType || !localKey) continue

    if (value === '') {
      const { error } = await supabase
        .from('bio_qbo_mappings')
        .delete()
        .eq('mapping_type', mappingType)
        .eq('local_key', localKey)
      if (error) throw new ActionError(error.message)
      continue
    }

    const sep = value.indexOf('::')
    const { error } = await supabase.from('bio_qbo_mappings').upsert(
      {
        mapping_type: mappingType,
        local_key: localKey,
        qbo_id: sep === -1 ? value : value.slice(0, sep),
        qbo_name: sep === -1 ? null : value.slice(sep + 2),
      },
      { onConflict: 'mapping_type,local_key' }
    )
    if (error) throw new ActionError(error.message)
  }

  revalidatePath('/settings')
}

/** Manual (re)sync of one expense, from the expense page. */
export async function retryExpenseSync(expenseId: string) {
  await requireMemberId()
  const supabase = await createClient()

  const result = await syncExpenseToQbo(supabase, expenseId)
  revalidatePath('/expenses')
  revalidatePath(`/expenses/${expenseId}`)
  if (!result.ok) throw new ActionError(result.error ?? 'QuickBooks sync failed')
}
