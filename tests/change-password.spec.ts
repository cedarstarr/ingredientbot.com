import { test, expect } from '@playwright/test'

/**
 * /change-password page.
 *
 * Branches read from src/app/change-password/page.tsx:
 *   1. No session -> redirect('/login').
 *   2. Session present -> always renders <ChangePasswordForm />, regardless
 *      of the user's mustChangePassword flag. This page deliberately sits
 *      outside the (app)/(admin) route groups (whose layouts redirect here
 *      *when* mustChangePassword is true) and middleware.ts explicitly keeps
 *      it reachable even mid email-verification-gate — there is no second
 *      redirect out of this page for an authenticated user.
 *
 * The seeded staging test user (test@test.com / Test1234!) does NOT have
 * mustChangePassword set, so branch 2 above is exercised here purely as a
 * render check (the panel appears) rather than as a "forced change" flow.
 * We deliberately do not fill in and submit the form: doing so would call
 * PATCH /api/user/password and actually rotate the shared test user's
 * password, mutating state other specs depend on. Exercising the real
 * forced-password-change submission path needs a user seeded with
 * mustChangePassword: true, which the shared staging seed does not provide.
 */

test.describe('Change password (unauthenticated)', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('unauthenticated visitor is redirected to /login @smoke', async ({ page }) => {
    await page.goto('/change-password')
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('Change password (authenticated)', () => {
  // Scoped through <main> deliberately: when Next's SSR stream closes early, the
  // resolved content is left doubled — once in <main>, once orphaned in a hidden
  // <div id="S:0"> sibling under <body>. Unscoped testids then hit two nodes and
  // trip Playwright strict mode (FOU-388; same mechanism diagnosed in padjobs FOU-389).
  test('authenticated user without mustChangePassword still sees the form render', async ({ page }) => {
    await page.goto('/change-password')
    await expect(page.getByRole('main').getByTestId('change-password-panel')).toBeVisible({ timeout: 10_000 })
  })
})
