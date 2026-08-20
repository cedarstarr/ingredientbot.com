import { test, expect } from '@playwright/test'

/**
 * Settings — palate profile (F87).
 * Derived taste profile: read-only card + Reset action. The staging test user
 * has no seeded ratings/completions, so the honest empty state is the
 * realistic path here — the populated-state markup is covered structurally
 * (headings/testids render only when data exists) rather than requiring a
 * specific taste history to be seeded.
 */

test.describe('Palate profile (F87)', () => {
  test.setTimeout(60000)

  test('settings page shows the Palate Profile card', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const card = page.getByRole('main').getByTestId('palate-profile-card')
    await expect(card).toBeVisible()
    await expect(card.getByRole('heading', { name: /your palate profile/i })).toBeVisible()
  })

  test('explains the profile is learned from cooking history, not user-entered', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const card = page.getByRole('main').getByTestId('palate-profile-card')
    await expect(card).toContainText(/learned automatically/i)
  })

  test('empty state: shows the "not enough cooking history" message for a fresh account @smoke', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const card = page.getByRole('main').getByTestId('palate-profile-card')
    // The card testid appears only once the client fetch resolves (the skeleton
    // carries palate-profile-loading), so await it before branching — a bare
    // isVisible() check races the fetch and silently takes the wrong branch.
    await expect(card).toBeVisible()

    // The staging test user has no seeded ratings/completions/cooks, so the
    // honest empty state should render rather than fabricated data.
    const empty = card.getByTestId('palate-empty-state')
    if (await empty.isVisible().catch(() => false)) {
      await expect(empty).toContainText(/not enough cooking history/i)
      // Reset is disabled when there's nothing to reset
      await expect(card.getByTestId('palate-reset')).toBeDisabled()
    } else {
      // If staging data has since produced a real profile, at least one
      // category section must be present instead.
      const anyCategory = card.getByTestId(/palate-(top-cuisines|loved-flavors|avoided-ingredients)/)
      await expect(anyCategory.first()).toBeVisible()
    }
  })

  test('Reset button is present and accessible via keyboard focus', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const resetBtn = page.getByRole('main').getByTestId('palate-reset')
    await expect(resetBtn).toBeVisible()

    // Reset is correctly disabled when there is no profile to clear, and a
    // disabled button cannot take focus — only assert focusability when enabled.
    if (await resetBtn.isEnabled()) {
      await resetBtn.focus()
      await expect(resetBtn).toBeFocused()
    }
  })

  test('Reset clears the profile and returns to the empty state, if it was populated', async ({ page }) => {
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')

    const card = page.getByRole('main').getByTestId('palate-profile-card')
    const resetBtn = card.getByTestId('palate-reset')
    await expect(resetBtn).toBeVisible()

    const wasEnabled = await resetBtn.isEnabled()
    if (wasEnabled) {
      await resetBtn.click()
      await expect(card.getByTestId('palate-empty-state')).toBeVisible()
      await expect(resetBtn).toBeDisabled()
    } else {
      // Nothing to reset — assert the disabled affordance itself is correct.
      await expect(resetBtn).toBeDisabled()
    }
  })
})
