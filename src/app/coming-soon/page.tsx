import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Coming Soon — IngredientBot',
  robots: { index: false, follow: false },
}

export default function ComingSoonPage() {
  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-6 max-w-md">
        <div className="inline-block px-3 py-1 rounded-full bg-[hsl(var(--color-warning-muted))] border border-[hsl(var(--color-warning)/0.3)] text-[hsl(var(--color-warning-fg))] text-sm font-medium tracking-wide uppercase">
          Coming Soon
        </div>
        <h1 className="text-5xl font-bold text-foreground tracking-tight">IngredientBot</h1>
        <p className="text-muted-foreground text-lg leading-relaxed">
          AI-powered recipe intelligence. Discover what you can make with what you already have.
        </p>
        <p className="text-[hsl(var(--color-warning))] text-sm font-medium">Something delicious is cooking. Coming soon.</p>
      </div>
    </main>
  )
}
