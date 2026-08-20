import { test, expect } from '@playwright/test'
import { randomUUID } from 'crypto'
import { Client } from 'pg'

/**
 * F89 — voice sous-chef (hands-free Q&A in cooking mode).
 *
 * CookingModeClient's `recipe` prop is server-rendered from the DB (an RSC
 * read in src/app/(app)/kitchen/cook/[id]/page.tsx, not a client fetch), so
 * page.route() can't fake the recipe itself — only the /sous-chef call. We
 * seed one real recipe row for the test user so the page has real steps to
 * attach the sous-chef sheet to.
 *
 * Uses `pg` directly (already a direct dependency, same driver
 * @prisma/adapter-pg wraps) rather than the generated Prisma client: the
 * generated client is ESM-only (`import.meta`) and fails to load under
 * Playwright's CJS test transform — scripts/_prisma.ts's driver-adapter
 * pattern only works there because scripts run via `tsx`, not Playwright.
 *
 * The /sous-chef route itself already no-ops the broker call under
 * PLAYWRIGHT_TEST=true (set by playwright.config.ts's webServer), matching
 * the same pattern src/app/api/recipes/[id]/chat/route.ts uses — so the
 * "streamed answer" test below hits the real route but never the real broker.
 */

process.loadEnvFile?.()

const RECIPE_TITLE = 'Sous-Chef Test Skillet'

let recipeId: string

test.describe('Kitchen — voice sous-chef (F89)', () => {
  test.setTimeout(60000)

  test.beforeAll(async () => {
    const db = new Client({ connectionString: process.env.DATABASE_URL })
    await db.connect()
    try {
      const { rows } = await db.query('SELECT id FROM users WHERE email = $1', ['test@test.com'])
      const userId = rows[0]?.id
      if (!userId) throw new Error('test@test.com not seeded on this DB — run /build-seed first')

      const recipeData = {
        title: RECIPE_TITLE,
        ingredients: [{ name: 'chicken thigh', amount: '2', unit: 'whole' }],
        steps: [
          'Pat the chicken dry and season both sides with salt and pepper.',
          'Sear skin-side down in a hot skillet for 6 minutes until golden.',
        ],
      }

      recipeId = randomUUID()
      await db.query(
        `INSERT INTO recipes (id, user_id, title, servings, source_ingredients, recipe_data, raw_text, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, now(), now())`,
        [recipeId, userId, RECIPE_TITLE, 2, ['chicken thigh'], JSON.stringify(recipeData), `# ${RECIPE_TITLE}`]
      )
    } finally {
      await db.end()
    }
  })

  test.afterAll(async () => {
    if (!recipeId) return
    const db = new Client({ connectionString: process.env.DATABASE_URL })
    await db.connect()
    try {
      await db.query('DELETE FROM recipes WHERE id = $1', [recipeId])
    } finally {
      await db.end()
    }
  })

  test.beforeEach(async ({ page }) => {
    await page.goto(`/kitchen/cook/${recipeId}`)
    await page.waitForLoadState('domcontentloaded')
  })

  test('sous-chef trigger opens the sheet with a text-fallback input', async ({ page }) => {
    const trigger = page.getByRole('main').getByTestId('sous-chef-trigger')
    await expect(trigger).toBeVisible()
    await trigger.click()

    // Playwright's browsers (chromium/webkit headless) don't implement
    // SpeechRecognition, so the mic button legitimately never renders in this
    // suite — "never show a dead mic" working as intended, not a gap. The text
    // fallback must always be there regardless.
    await expect(page.getByTestId('sous-chef-input')).toBeVisible()
  })

  test('text-fallback question streams an answer into the bottom sheet @smoke', async ({ page }) => {
    await page.getByRole('main').getByTestId('sous-chef-trigger').click()

    const input = page.getByTestId('sous-chef-input')
    await input.fill('How do I know when the chicken is done?')
    await page.getByTestId('sous-chef-submit').click()

    // The sheet is a Radix portal — rendered outside <main>, so it's scoped
    // directly rather than through getByRole('main').
    const answer = page.getByTestId('sous-chef-answer')
    await expect(answer).toBeVisible()
    await expect(answer).toHaveText(/Mock sous-chef answer for testing\./)
  })

  test('a failed answer shows honest failure copy, never a fabricated instruction', async ({ page }) => {
    // Override the PLAYWRIGHT_TEST success mock for this one request so we can
    // exercise the model-returned-error path without hitting the real broker.
    await page.route(`**/api/recipes/${recipeId}/sous-chef`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: `data: ${JSON.stringify({ error: 'stream-error' })}\n\ndata: [DONE]\n\n`,
      })
    })

    await page.getByRole('main').getByTestId('sous-chef-trigger').click()
    await page.getByTestId('sous-chef-input').fill('Can I substitute the chicken for tofu?')
    await page.getByTestId('sous-chef-submit').click()

    const answer = page.getByTestId('sous-chef-answer')
    await expect(answer).toBeVisible()
    await expect(answer).toHaveText(/couldn't answer/i)
    // Honest failure only — never confident filler or a guessed substitution.
    await expect(answer).not.toContainText(/substitute|tofu/i)
  })
})
