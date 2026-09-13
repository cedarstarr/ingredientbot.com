import { KitchenPanel } from '@/components/kitchen/kitchen-panel'

export const metadata = { title: 'Kitchen — IngredientBot' }

// F86: ?tonight=1 is read here on the server and passed down as a prop. Reading it
// with useSearchParams inside the client panel needs a Suspense boundary, and that
// boundary bails out to a client render during hydration — remounting KitchenPanel
// and wiping anything the user had already typed into the composer.
export default async function KitchenPage({
  searchParams,
}: {
  searchParams: Promise<{ tonight?: string }>
}) {
  const { tonight } = await searchParams
  return <KitchenPanel tonightMode={tonight === '1'} />
}
