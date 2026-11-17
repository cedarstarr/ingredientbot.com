import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CheckCircle, ChefHat } from 'lucide-react'
import { prisma } from '@/lib/prisma'
import { Button } from '@/components/ui/button'
import { UNSUBSCRIBE_TOKEN_RE } from '@/lib/unsubscribe'

export const metadata: Metadata = {
  title: 'Unsubscribe — IngredientBot',
  robots: { index: false, follow: false },
}

// chose a server action (POST) for the change over doing it on GET: mail scanners and link
// prefetchers open every URL in an email, and would unsubscribe users who never clicked.
async function unsubscribe(formData: FormData) {
  'use server'
  const token = String(formData.get('token') ?? '')
  if (!UNSUBSCRIBE_TOKEN_RE.test(token)) return
  await prisma.user.updateMany({
    where: { unsubscribeToken: token },
    data: { notifyMarketing: false, notifyProduct: false },
  })
  redirect(`/unsubscribe/${token}?done=1`)
}

export default async function UnsubscribePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ done?: string }>
}) {
  const { token } = await params
  const { done } = await searchParams
  if (!UNSUBSCRIBE_TOKEN_RE.test(token)) notFound()
  const user = await prisma.user.findUnique({ where: { unsubscribeToken: token }, select: { id: true } })
  if (!user) notFound()

  return (
    <main id="main-content" className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <Link href="/" className="mb-8 flex items-center gap-2 transition-opacity hover:opacity-80">
        <ChefHat className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold text-foreground">IngredientBot</span>
      </Link>
      <div className="w-full max-w-sm rounded-lg border border-border bg-card px-8 py-10 text-center" data-testid="unsubscribe-card">
        {done ? (
          <>
            <CheckCircle className="mx-auto h-10 w-10 text-primary" />
            <h1 className="mt-4 text-xl font-semibold text-balance text-foreground">You&apos;re unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We won&apos;t send you marketing or product emails. Account emails such as password resets still arrive.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold text-balance text-foreground">Unsubscribe from emails?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You&apos;ll stop receiving marketing and product emails, including weekly meal plan digests.
            </p>
            <form action={unsubscribe} className="mt-6">
              <input type="hidden" name="token" value={token} />
              <Button type="submit" className="w-full focus-visible:ring-2" data-testid="unsubscribe-confirm">
                Unsubscribe
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
