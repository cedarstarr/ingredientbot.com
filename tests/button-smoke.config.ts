import type { Page } from '@playwright/test'

export interface ButtonSmokeRow {
  route: string
  cta: string
  fill?: (page: Page) => Promise<void>
  expectResultTestId?: string
}

// Hand-authored (2026-09-09) — the prior `rows: []` reported "0/0 pass" while
// testing nothing (per middleware.ts PUBLIC_PATHS + the (app)/(admin) route
// groups, the entire /kitchen split-panel feature and every AI-touching route
// require an authenticated session, so the crawler's anonymous walk cannot
// reach them). Following the gurumind.ai precedent (same auth stack, same
// shape) for the three genuinely public, API-triggering forms:
//
//   /login            — real credentials (test@test.com / Test1234!, seeded
//                        to staging), full happy-path through NextAuth's
//                        /api/auth/callback/credentials.
//   /signup           — unique email per run; leaves a real row in the
//                        staging DB via POST /api/auth/signup. Password must
//                        clear validatePassword()'s 12-char/no-sequential-run
//                        policy (verified against src/lib/password-policy.ts).
//   /forgot-password  — POST /api/auth/forgot-password always returns 200
//                        regardless of whether the email exists (no
//                        enumeration), so a fake address is safe and sends
//                        no real email.
//
// No AI row: every AI-touching route (substitute/chat/modify/convert-diet,
// analyze-photo) lives under the (app) route group behind auth. There is no
// public surface that reaches dietaryModel()/brokerModel(), so there is
// nothing for this crawler to exercise on the AI path.
//
// Removed: '/' — pure marketing page, its only CTAs are <Link> elements to
//   /signup and /what-can-i-make, no API call.
// Removed: '/recipes', '/ingredients', '/allergens' — server-rendered browse
//   and glossary pages (per middleware.ts's own comments), no client API call.
// Removed: '/what-can-i-make' — the reverse-ingredient search has no submit
//   button: adding a chip fires the search via a useEffect automatically, and
//   the only other button ("Show more") is conditionally rendered when
//   results exceed one page. Neither is a stable click target the crawler can
//   depend on without risking a false failure when a chosen ingredient
//   doesn't happen to produce >24 matches.
// Removed: '/r/[slug]' — dynamic public recipe share page; "Cook this" (POST
//   /api/recipes/[id]/fork) is a genuine anonymous-friendly CTA, but the route
//   needs a real, currently-public recipe slug that isn't knowable from the
//   static route list, and isPublic recipes can be un-published between runs.
// Removed: '/reset-password' — only renders a working form given a valid
//   token from the forgot-password email flow; not independently drivable
//   from a cold page load (same reasoning as gurumind.ai).
// Removed: '/verify-email' — the verification fetch fires automatically from
//   token/email query params on load, not from a button click; its only
//   buttons are <Link>s back to /login, which hit no API.
// Removed: '/privacy', '/terms', '/coming-soon' — static/legal pages, no CTA.
export const rows: ButtonSmokeRow[] = [
  {
    route: '/login',
    cta: 'Sign In',
    fill: async (page: Page) => {
      await page.getByLabel('Email', { exact: true }).fill('test@test.com')
      await page.getByLabel('Password', { exact: true }).fill('Test1234!')
    },
  },
  {
    route: '/signup',
    cta: 'Create Account',
    fill: async (page: Page) => {
      const email = `qa-button-fix-${Date.now()}@example.com`
      // 13 chars, upper+lower+digit+symbol, no 4-char run against any of
      // password-policy.ts's sequential alphabets, no email/name substring
      // hit — verified directly against validatePassword() before writing
      // this row (npx tsx -e '...' returned issues: []).
      const password = 'Qa9!Smoke2026'
      await page.getByLabel('Name', { exact: true }).fill('QA Button Fix')
      await page.getByLabel('Email', { exact: true }).fill(email)
      await page.getByTestId('signup-password').fill(password)
      await page.getByLabel('Confirm Password', { exact: true }).fill(password)
    },
  },
  {
    route: '/forgot-password',
    cta: 'Send Reset Link',
    fill: async (page: Page) => {
      await page.getByLabel('Email', { exact: true }).fill('qa-button-fix-nonexistent@example.com')
    },
  },
]
