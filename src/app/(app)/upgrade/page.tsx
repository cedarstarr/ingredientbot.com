import { Metadata } from 'next'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { UpgradeClient } from '@/components/upgrade/upgrade-client'

export const metadata: Metadata = {
  title: 'Upgrade to Pro — IngredientBot',
  description: 'Get unlimited AI recipe generations with IngredientBot Pro.',
}

export default async function UpgradePage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <UpgradeClient />
}
