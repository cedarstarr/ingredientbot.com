import type { Metadata } from 'next'
import Link from 'next/link'
import { ChefHat, Camera, Sparkles, Sliders, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ingredientbot.com'

export const metadata: Metadata = {
  alternates: {
    canonical: baseUrl,
  },
}

const webAppJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'IngredientBot',
  alternateName: 'Robot Food',
  url: baseUrl,
  description: 'AI-powered recipe suggestions based on ingredients you have. Type what\'s in your fridge, snap a photo, and get instant recipe ideas powered by Claude AI.',
  applicationCategory: 'FoodApplication',
  operatingSystem: 'Web',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Free to start — no credit card needed',
  },
  author: {
    '@type': 'Organization',
    name: 'IngredientBot',
    url: baseUrl,
  },
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(webAppJsonLd) }}
      />
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-foreground">Robot Food</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content">
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm text-primary mb-8">
          <Sparkles className="h-3.5 w-3.5" />
          Powered by Claude AI
        </div>
        <h1 className="text-5xl font-bold tracking-tight text-balance text-foreground sm:text-6xl lg:text-7xl">
          Your kitchen,{' '}
          <span className="text-primary">supercharged</span>{' '}
          by AI
        </h1>
        <p className="mt-6 text-xl text-muted-foreground max-w-2xl mx-auto text-balance">
          Type what&apos;s in your fridge, snap a photo, and get instant recipe ideas. Customize every detail with AI — lower calories, change cooking method, adjust servings.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button size="lg" asChild className="text-base px-8">
            <Link href="/signup">
              Start Cooking for Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild className="text-base px-8">
            <Link href="/login">Sign In</Link>
          </Button>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-foreground mb-12">
          Everything you need to cook smarter
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Camera className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Snap Your Fridge</h3>
            <p className="text-muted-foreground text-sm">
              Take a photo of your fridge and AI instantly identifies every ingredient. No typing required.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Instant Recipes</h3>
            <p className="text-muted-foreground text-sm">
              Get 4 tailored recipe suggestions the moment you add ingredients. Real-time AI streaming.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sliders className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Customize Anything</h3>
            <p className="text-muted-foreground text-sm">
              Lower calories, change cooking method, adjust servings with one click. AI rewrites on the fly.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-4xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-foreground mb-12">
          How it works
        </h2>
        <div className="space-y-6">
          {[
            { n: '1', title: 'Add your ingredients', desc: 'Type them in one by one, or snap a photo of your fridge. Robot Food recognizes them instantly.' },
            { n: '2', title: 'Browse AI-generated recipe suggestions', desc: 'Get 4 personalized recipe ideas based exactly on what you have. Filter by cuisine or dietary needs.' },
            { n: '3', title: 'Cook and customize in real-time', desc: 'Open any recipe to see full instructions. Tap to lower calories, switch cooking method, or change servings.' },
          ].map(step => (
            <div key={step.n} className="flex items-start gap-6 rounded-xl border border-border bg-card p-6">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-lg">
                {step.n}
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">{step.title}</h3>
                <p className="text-muted-foreground text-sm">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 py-20 text-center">
        <div className="rounded-2xl bg-primary/5 border border-primary/20 p-12">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to cook smarter?
          </h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join Robot Food and transform how you cook. Free to start — no credit card needed.
          </p>
          <Button size="lg" asChild className="text-base px-10">
            <Link href="/signup">
              Start Cooking for Free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-2 mb-2">
          <ChefHat className="h-4 w-4 text-primary" />
          <span className="font-semibold text-foreground">Robot Food</span>
        </div>
        <p>AI-powered recipe assistant. Cook smarter, eat better.</p>
      </footer>
    </div>
  )
}
