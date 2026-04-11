import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SettingsClient } from '@/components/settings/settings-client'
import { DietaryProfileSection } from '@/components/settings/dietary-profile-section'

export const metadata = { title: 'Settings — Robot Food' }

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your account and preferences.</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-sm font-medium text-muted-foreground mb-2">Account</h2>
        <p className="text-sm"><span className="text-muted-foreground">Email:</span> {session.user.email}</p>
        <p className="text-sm mt-1"><span className="text-muted-foreground">Name:</span> {session.user.name || 'Not set'}</p>
      </div>

      {/* F31: Dietary profile — persistent preferences applied to all AI generations */}
      <DietaryProfileSection />

      <SettingsClient />
    </div>
  )
}
