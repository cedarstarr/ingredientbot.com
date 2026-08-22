import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { ChefHat } from 'lucide-react'
import { ChangePasswordForm } from '@/components/auth/change-password-form'

export const metadata = { title: 'Update Your Password — IngredientBot' }

// Deliberately outside the (app)/(admin) route groups — those layouts redirect
// here when mustChangePassword is true, so this page must not live behind that
// same gate. It also carries no app nav, matching the "no distractions" ask:
// a user stuck here has exactly one thing to do.
export default async function ChangePasswordPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <main
      id="main-content"
      className="relative flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12"
    >
      <div className="mb-8 flex items-center gap-2">
        <ChefHat className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold text-foreground">IngredientBot</span>
      </div>
      <div className="w-full max-w-sm">
        <Suspense>
          <ChangePasswordForm />
        </Suspense>
      </div>
    </main>
  )
}
