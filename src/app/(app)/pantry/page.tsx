import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PantryClient } from '@/components/pantry/pantry-client'

export const metadata = { title: 'Pantry — IngredientBot' }

export default async function PantryPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <div className="max-w-4xl mx-auto px-10 py-8 pb-16 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[30px] font-bold tracking-tight leading-[1.1]">Your pantry</h1>
          <p className="text-muted-foreground text-[15px] mt-1">Keep track of what&apos;s in your kitchen. Items auto-include when generating recipes.</p>
        </div>
      </div>
      <PantryClient />
    </div>
  )
}
