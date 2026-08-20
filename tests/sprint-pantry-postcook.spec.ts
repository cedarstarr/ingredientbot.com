import { test, expect } from '@playwright/test'

/**
 * F88 — post-cook outcome loop (the "Sticky").
 *
 * The UI flow needs a real saved recipe owned by the test user, which staging
 * may or may not have (see recipe-flow.spec.ts / ingredients-recipes.spec.ts
 * for the same caveat) — so it's skipped rather than asserted when /saved is
 * empty. The AI tip call runs under PLAYWRIGHT_TEST=true (set by the webServer
 * env in playwright.config.ts), which short-circuits cook-feedback/route.ts to
 * a deterministic mock tip instead of hitting the broker — same convention as
 * every other AI route in this repo (generate, modify, substitute, nutrition).
 *
 * The auth + IDOR checks against the raw API don't need seeded data at all,
 * so they run unconditionally.
 */

test.describe('Post-cook outcome UI (F88)', () => {
  test.setTimeout(60000)

  test('logging a cook prompts for outcome, submitting pins an AI tip @smoke', async ({ page }) => {
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const recipeLink = page.getByRole('main').getByRole('link', { name: /view recipe/i }).first()
    const hasRecipe = await recipeLink.count()
    test.skip(hasRecipe === 0, 'No saved recipes for the test user on this environment')

    await recipeLink.click()
    await page.waitForURL(/\/recipe\/[^/]+$/)

    const main = page.getByRole('main')
    const cookButton = main.getByTestId('cooked-this-button')
    await expect(cookButton).toBeVisible({ timeout: 10_000 })
    await cookButton.click()

    // Outcome prompt appears once the /cook POST resolves with a completionId
    const greatBtn = main.getByTestId('cook-outcome-great')
    const okayBtn = main.getByTestId('cook-outcome-okay')
    const failedBtn = main.getByTestId('cook-outcome-failed')
    await expect(greatBtn).toBeVisible({ timeout: 10_000 })
    await expect(okayBtn).toBeVisible()
    await expect(failedBtn).toBeVisible()

    // Optional note — never blocks, but exercise it since it's part of the same submit
    await main.getByPlaceholder(/add a note/i).fill('Sauce broke a bit — heat was too high.')

    // One tap submits outcome + note together
    await greatBtn.click()

    await expect(main.getByText(/noted for next time/i)).toBeVisible({ timeout: 10_000 })

    // The AI tip (mocked deterministic response under PLAYWRIGHT_TEST) pins on the
    // recipe view immediately — no reload needed.
    await expect(main.getByTestId('recipe-ai-tip')).toBeVisible({ timeout: 10_000 })
    await expect(main.getByTestId('recipe-ai-tip')).toContainText(/next time/i)
  })

  test('the pinned AI tip survives a reload (persisted on RecipeCompletion) @smoke', async ({ page }) => {
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const recipeLink = page.getByRole('main').getByRole('link', { name: /view recipe/i }).first()
    const hasRecipe = await recipeLink.count()
    test.skip(hasRecipe === 0, 'No saved recipes for the test user on this environment')

    await recipeLink.click()
    await page.waitForURL(/\/recipe\/[^/]+$/)
    const url = page.url()

    const main = page.getByRole('main')
    await main.getByTestId('cooked-this-button').click()
    await expect(main.getByTestId('cook-outcome-okay')).toBeVisible({ timeout: 10_000 })
    await main.getByTestId('cook-outcome-okay').click()
    await expect(main.getByTestId('recipe-ai-tip')).toBeVisible({ timeout: 10_000 })

    await page.goto(url)
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('main').getByTestId('recipe-ai-tip')).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('cook-feedback API — unauthenticated (F88)', () => {
  // Clear the project-level authenticated storageState — same pattern as the
  // unauthenticated blocks in pantry-journey.spec.ts / saved.spec.ts.
  test.use({ storageState: { cookies: [], origins: [] } })

  test('request without a session is rejected with 401', async ({ request }) => {
    const res = await request.post('/api/recipes/anything/cook-feedback', {
      data: { completionId: 'x', outcome: 'great' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('cook-feedback API — authenticated auth + ownership (F88)', () => {
  test('a missing/invalid outcome is rejected with 400', async ({ request }) => {
    const res = await request.post('/api/recipes/anything/cook-feedback', {
      data: { completionId: 'some-id', outcome: 'amazing' },
    })
    expect(res.status()).toBe(400)
  })

  test('a completionId that does not belong to the caller 404s (IDOR guard)', async ({ request }) => {
    // Neither the recipe id nor the completion id exist for this user — the
    // ownership lookup (userId + recipeId + completionId, never trusting the
    // body alone) must return nothing rather than leaking another user's row.
    const res = await request.post('/api/recipes/nonexistent-recipe-id/cook-feedback', {
      data: { completionId: 'not-a-real-completion-id', outcome: 'great' },
    })
    expect(res.status()).toBe(404)
  })
})
