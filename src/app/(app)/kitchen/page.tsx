import { Suspense } from 'react'
import { KitchenPanel } from '@/components/kitchen/kitchen-panel'

export const metadata = { title: 'Kitchen — IngredientBot' }

export default function KitchenPage() {
  // F86: KitchenPanel reads ?tonight=1 via useSearchParams — requires a Suspense
  // boundary (same pattern as the (auth) pages) or Next.js opts the whole route
  // out of static rendering.
  return (
    <Suspense>
      <KitchenPanel />
    </Suspense>
  )
}
