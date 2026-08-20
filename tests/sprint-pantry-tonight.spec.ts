import { test, expect } from '@playwright/test'

/**
 * F86 "Tonight" screen (dashboard hero -> /kitchen?tonight=1, collapsed Options
 * disclosure) and F90 meal timing orchestrator (/api/meal-plan/orchestrate +
 * meal-plan "Cook Together" UI).
 *
 * Every testid query is scoped through page.getByRole('main') — the (app) route
 * group has a loading.tsx boundary, which is the known SSR-stream-doubling trap
 * (a hidden div#S:0 twin can otherwise make a bare getByTestId hit 2 nodes).
 *
 * The meal-plan "Cook Together" section only shows a day picker once the test
 * user has 2+ recipes assigned to the same day — real state this suite can't
 * guarantee on staging. Those tests are written to run when the state exists
 * (mocking the orchestrate network response for a deterministic timeline) and
 * skip themselves with a clear reason otherwise; the API contract itself
 * (auth, count validation, ownership) is covered unconditionally below via
 * direct request calls, same pattern as tests/api-health.spec.ts.
 */

test.describe('F86: Tonight card (dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
  })

  test('tonight card renders with heading and primary CTA', async ({ page }) => {
    const main = page.getByRole('main')
    const card = main.getByTestId('tonight-card')
    await expect(card).toBeVisible()
    await expect(card.getByText(/what's for dinner tonight/i)).toBeVisible()

    const cta = main.getByTestId('tonight-generate')
    await expect(cta).toBeVisible()
    await expect(cta).toHaveAttribute('href', '/kitchen?tonight=1')
  })

  test('clicking the tonight CTA navigates to /kitchen with the tonight param @smoke', async ({ page }) => {
    await page.getByRole('main').getByTestId('tonight-generate').click()
    await page.waitForURL(/\/kitchen\?tonight=1/, { timeout: 15_000 })
  })
})

test.describe('F86: Kitchen Options disclosure', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Options disclosure is collapsed by default', async ({ page }) => {
    const toggle = page.getByRole('main').getByTestId('kitchen-options-toggle')
    await expect(toggle).toBeVisible()
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    // A toggle that lives inside the collapsed panel should not be visible yet.
    await expect(page.getByRole('button', { name: /strict ingredients only/i })).toBeHidden()
  })

  test('opening Options reveals the mode toggles and filters, panel keeps working', async ({ page }) => {
    const toggle = page.getByRole('main').getByTestId('kitchen-options-toggle')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')

    const strictBtn = page.getByRole('button', { name: /strict ingredients only/i })
    await expect(strictBtn).toBeVisible()
    await strictBtn.click()
    await expect(strictBtn).toHaveAttribute('aria-pressed', 'true')

    // Existing filters still present alongside the relocated toggles.
    await expect(page.getByRole('button', { name: /15 min/i })).toBeVisible()
  })

  test('the composer stays the one obvious action when Options is closed', async ({ page }) => {
    // Textarea + Find recipes CTA are the only things visible above the fold —
    // no mode toggle is reachable without opening Options first.
    await expect(
      page.getByPlaceholder('2 chicken thighs, broccoli, garlic, sesame oil, gochujang...'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: /find recipes/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /protein-max/i })).toBeHidden()
  })
})

test.describe('F86: ?tonight=1 landing', () => {
  test('lands with Options collapsed, a Tonight indicator, and no auto-fired generation', async ({ page }) => {
    await page.goto('/kitchen?tonight=1')
    await page.waitForLoadState('domcontentloaded')

    const main = page.getByRole('main')
    await expect(main.getByText(/picking tonight's dinner/i)).toBeVisible()

    const toggle = main.getByTestId('kitchen-options-toggle')
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')

    // Keep it simple: no AI call fires on load. The empty state (or the
    // composer itself) is what's showing, never a suggestions grid.
    await expect(main.getByText(/add your ingredients/i)).toBeVisible()
  })
})

// Unauthenticated path — own describe block using the same test.use override
// pattern as tests/api-health.spec.ts, since the project's default storageState
// is the authenticated test user.
test.describe('F90: meal-plan orchestrate API contract — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('requires authentication', async ({ request }) => {
    const res = await request.post('/api/meal-plan/orchestrate', {
      data: { recipeIds: ['a', 'b'] },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('F90: meal-plan orchestrate API contract', () => {
  test('rejects fewer than 2 recipe ids', async ({ request }) => {
    const res = await request.post('/api/meal-plan/orchestrate', {
      data: { recipeIds: ['solo-id'] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects more than 3 recipe ids', async ({ request }) => {
    const res = await request.post('/api/meal-plan/orchestrate', {
      data: { recipeIds: ['a', 'b', 'c', 'd'] },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects recipe ids that do not belong to the caller (or do not exist)', async ({ request }) => {
    // Single-query ownership check: an id that isn't the caller's simply doesn't
    // come back from the scoped findMany, so the count mismatch 404s.
    const res = await request.post('/api/meal-plan/orchestrate', {
      data: { recipeIds: ['nonexistent-recipe-id-1', 'nonexistent-recipe-id-2'] },
    })
    expect(res.status()).toBe(404)
  })
})

test.describe('F90: Cook Together UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/meal-plan')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Cook Together section is always present', async ({ page }) => {
    await expect(page.getByRole('main').getByText(/cook together/i)).toBeVisible()
  })

  test('shows either the empty-state hint or a day picker', async ({ page }) => {
    const main = page.getByRole('main')
    const emptyHint = main.getByText(/assign at least 2 recipes/i)
    const dayPicker = main.getByRole('button', { name: /^(sun|mon|tue|wed|thu|fri|sat)$/i }).first()
    await expect(emptyHint.or(dayPicker)).toBeVisible()
  })

  test('picking a qualifying day and 2 recipes builds a timeline', async ({ page }) => {
    const main = page.getByRole('main')
    const dayPicker = main.getByRole('button', { name: /^(sun|mon|tue|wed|thu|fri|sat)$/i }).first()

    if ((await dayPicker.count()) === 0) {
      test.skip(true, 'test user has no day with 2+ planned recipes on this environment — API contract covered above')
    }

    // Mock the orchestrate call so the timeline assertion is deterministic
    // regardless of which real recipes the test account happens to have.
    await page.route('**/api/meal-plan/orchestrate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          steps: [
            { minuteOffset: 0, recipeId: 'mock-1', recipeTitle: 'Mock Recipe A', instruction: 'Preheat the oven to 400°F.' },
            { minuteOffset: 12, recipeId: 'mock-2', recipeTitle: 'Mock Recipe B', instruction: 'Start chopping vegetables.' },
          ],
        }),
      })
    })

    await dayPicker.click()

    const checkboxes = main.getByRole('checkbox')
    const count = await checkboxes.count()
    test.skip(count < 2, 'fewer than 2 recipes available on this day to select')

    await checkboxes.nth(0).click()
    await checkboxes.nth(1).click()

    const orchestrateBtn = main.getByTestId('orchestrate-button')
    await expect(orchestrateBtn).toBeEnabled()
    await orchestrateBtn.click()

    const timeline = main.getByTestId('orchestrate-timeline')
    await expect(timeline).toBeVisible()
    await expect(timeline.getByText('Preheat the oven to 400°F.')).toBeVisible()
    await expect(timeline.getByText('+12m')).toBeVisible()

    // Steps are tickable — client-side only, nothing persisted.
    const firstStepCheckbox = timeline.getByRole('checkbox').first()
    await firstStepCheckbox.click()
    await expect(firstStepCheckbox).toHaveAttribute('data-checked', '')
  })
})
