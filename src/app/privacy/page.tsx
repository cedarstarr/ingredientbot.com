import type { Metadata } from 'next'
import Link from 'next/link'
import { ChefHat } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Privacy Policy — Robot Food',
  description: 'How Robot Food collects, uses, and protects your data when you use our AI recipe assistant.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-4xl items-center px-4">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <ChefHat className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg text-foreground">Robot Food</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="mb-10">
          <h1 className="text-4xl font-bold tracking-tight text-foreground text-balance mb-3">
            Privacy Policy
          </h1>
          <p className="text-sm text-muted-foreground">Last updated: March 2026</p>
        </div>

        <div className="prose prose-neutral dark:prose-invert max-w-none space-y-10 text-foreground">

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">What we collect</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Account information</strong> — your email address and a securely hashed password when you sign up.</li>
              <li><strong className="text-foreground">Recipes you generate and save</strong> — recipe content and the ingredients you used are stored in our database so you can access them later.</li>
              <li><strong className="text-foreground">Ingredient inputs</strong> — the ingredients you enter in the kitchen are sent to Anthropic&apos;s Claude API to generate recipe suggestions. Anthropic may process and use this data per their own privacy policy.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">How we use it</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>Generate AI-powered recipe suggestions based on your ingredients.</li>
              <li>Save and display your recipe history within your account.</li>
              <li>Send transactional account emails such as welcome messages and password reset links.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">AI disclosure</h2>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-6">
              <p className="text-foreground">
                The ingredients you enter in the kitchen are sent to <strong>Anthropic&apos;s Claude API</strong> to generate recipe suggestions. This data leaves our servers and is processed by Anthropic. Please review{' '}
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-4 hover:opacity-80"
                >
                  Anthropic&apos;s privacy policy
                </a>{' '}
                to understand how they handle API inputs.
              </p>
              <p className="mt-3 text-muted-foreground text-sm">
                Do not enter sensitive personal information (health conditions, allergies requiring medical management, etc.) in the ingredient input field.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Third-party services</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {[
                { name: 'Anthropic / Claude', role: 'AI recipe generation from your ingredient inputs' },
                { name: 'ZeptoMail', role: 'Transactional email delivery (welcome, password reset)' },
                { name: 'Railway', role: 'Database hosting for your account and recipe data' },
                { name: 'Vercel', role: 'Application hosting and edge infrastructure' },
              ].map(service => (
                <div key={service.name} className="rounded-lg border border-border bg-card p-4">
                  <p className="font-medium text-foreground">{service.name}</p>
                  <p className="text-sm text-muted-foreground mt-1">{service.role}</p>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Data retention</h2>
            <p className="text-muted-foreground">
              Your account information and saved recipes are retained until you delete your account. You can delete your account at any time from your{' '}
              <Link href="/settings" className="text-primary underline underline-offset-4 hover:opacity-80">
                Settings page
              </Link>.
              Upon deletion, your data is permanently removed from our systems.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Your rights</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>Delete your account at any time from your Settings page.</li>
              <li>Request a copy of or deletion of your data by emailing us.</li>
              <li>Opt out of any marketing emails via the unsubscribe link in any email we send.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold text-foreground mb-3">Contact</h2>
            <p className="text-muted-foreground">
              Questions about this policy or your data? Email us at{' '}
              <a
                href="mailto:hello@ingredientbot.com"
                className="text-primary underline underline-offset-4 hover:opacity-80"
              >
                hello@ingredientbot.com
              </a>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-sm text-muted-foreground">
        <div className="flex items-center justify-center gap-4">
          <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
        </div>
      </footer>
    </div>
  )
}
