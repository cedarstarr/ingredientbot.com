import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PantryClient } from '@/components/pantry/pantry-client'

export const metadata = { title: 'Pantry — Robot Food' }

export default async function PantryPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Pantry</h1>
        <p className="text-muted-foreground mt-1">
          Keep track of what&apos;s in your kitchen. Pantry items are automatically included when you generate recipes.
        </p>
      </div>
      <PantryClient />
    </div>
  )
}
