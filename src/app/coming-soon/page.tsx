import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Coming Soon — IngredientBot',
  robots: { index: false, follow: false },
}

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-amber-50 flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="inline-block px-3 py-1 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-sm font-medium tracking-wide uppercase">
          Coming Soon
        </div>
        <h1 className="text-5xl font-bold text-stone-900 tracking-tight">IngredientBot</h1>
        <p className="text-stone-500 text-lg leading-relaxed">
          AI-powered recipe intelligence. Discover what you can make with what you already have.
        </p>
        <p className="text-orange-500 text-sm font-medium">Something delicious is cooking. Coming soon.</p>
      </div>
    </main>
  )
}
