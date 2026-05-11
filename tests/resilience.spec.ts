import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Resilience spec — verifies the app degrades gracefully when an upstream
 * AI provider fails. Mocks the Anthropic HTTP endpoint that backs the
 * /api/recipes/[id]/substitute handler (via @ai-sdk/anthropic) and asserts
 * the user-visible error surface from src/app/error.tsx renders instead of
 * a hung spinner or a crashed page.
 *
 * Targeted route: POST /api/recipes/[id]/substitute (driven from the
 * recipe detail page substitution panel). Chosen over analyze-photo
 * because it lives behind a real authenticated page (/recipes/[id]) that
 * can render error.tsx, whereas analyze-photo is invoked from the kitchen
 * panel and surfaces failures inline.
 */
test.describe('Resilience — AI upstream failure', () => {
  test.setTimeout(60000)

  test('substitute flow surfaces the error boundary when Anthropic returns 500', async ({ page }) => {
    // Block every outbound call to api.anthropic.com with a 500. The
    // @ai-sdk/anthropic transport is plain fetch, so page.route intercepts
    // it before it leaves the browser context.
    await page.route('**/api.anthropic.com/**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: { type: 'api_error', message: 'mocked upstream failure' } }),
      }),
    )

    await loginAsTestUser(page)

    // Navigate to the saved recipes index — the test user has at least one
    // seeded recipe in staging. Click into the first recipe detail page.
    await page.goto('/recipes')
    await page.waitForLoadState('domcontentloaded')

    const firstRecipeLink = page.getByTestId('recipe-card-link').first()
    await firstRecipeLink.click()
    await page.waitForLoadState('domcontentloaded')

    // Open the substitution panel for the first ingredient.
    const firstSubstituteBtn = page.getByTestId('ingredient-substitute-button').first()
    await firstSubstituteBtn.click()

    // The route boundary at src/app/error.tsx renders this testid when a
    // server component throws. We assert against the data-testid rather
    // than copy so future copy changes do not silently break the test.
    const errorBoundary = page.getByTestId('route-error-boundary')
    await expect(errorBoundary).toBeVisible({ timeout: 15000 })
    await expect(errorBoundary).toContainText(/something went wrong/i)
  })
})
