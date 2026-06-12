import { createClient } from '@/lib/supabase/server'

export class ActionError extends Error {}

/** Resolve the current partner's bio_team_members id, or throw. */
export async function requireMemberId(): Promise<string> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new ActionError('Not authenticated')

  const { data: member } = await supabase
    .from('bio_team_members')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) throw new ActionError('Not an active SAIF Bio team member')
  return member.id
}

export function requiredString(formData: FormData, key: string): string {
  const value = formData.get(key)
  if (typeof value !== 'string' || value.trim() === '') {
    throw new ActionError(`Missing required field: ${key}`)
  }
  return value.trim()
}

export function optionalString(formData: FormData, key: string): string | null {
  const value = formData.get(key)
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}
