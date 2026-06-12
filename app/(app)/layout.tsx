import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import NavShell from '@/components/NavShell'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Defense in depth: RLS already blocks non-partners, but show a clear
  // message instead of empty pages
  const { data: member } = await supabase
    .from('bio_team_members')
    .select('id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .maybeSingle()

  if (!member) {
    redirect('/access-denied')
  }

  return <NavShell>{children}</NavShell>
}
