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

      <div className="rounded-lg border border-border bg-card p-5">
        <h2 className="text-base font-semibold text-foreground mb-4">Account Info</h2>
        <dl className="space-y-3">
          <div className="text-sm">
            <dt className="inline text-muted-foreground">Email: </dt>
            <dd className="inline font-medium text-foreground">{session.user.email}</dd>
          </div>
          <div className="text-sm">
            <dt className="inline text-muted-foreground">Name: </dt>
            <dd className="inline font-medium text-foreground">{session.user.name || <span className="italic text-muted-foreground">Not set</span>}</dd>
          </div>
        </dl>
      </div>

      {/* F31: Dietary profile — persistent preferences applied to all AI generations */}
      <DietaryProfileSection />

      <SettingsClient />
    </div>
  )
}
