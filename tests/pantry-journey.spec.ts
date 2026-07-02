import { test, expect } from '@playwright/test'

/**
 * Pantry journey — F44 persistent pantry, F26 expiry badges.
 * Tests the core user flow: visit pantry, add an item, verify it appears, remove it.
 */

test.describe('Pantry journey (F44)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/pantry')
    await page.waitForLoadState('domcontentloaded')
    // Gate on the h1 so the App Router client transition has committed before we
    // query the add-input. The SW-registered client can briefly keep the outgoing
    // route tree mounted alongside the incoming one, momentarily duplicating the
    // input — waiting for the heading lets that settle to a single instance.
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
  })

  // Scope the input to the main landmark and target its testid — a single <main>
  // disambiguates even during a transition, and testid is the preferred selector.
  const pantryInput = (page: import('@playwright/test').Page) =>
    page.getByRole('main').getByTestId('pantry-add-input')

  test('pantry page loads and shows the add-to-pantry input', async ({ page }) => {
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()
    await expect(pantryInput(page)).toBeVisible()
  })

  test('adding an ingredient appends it to the pantry list', async ({ page }) => {
    const ingredient = `test-item-${Date.now()}`

    await pantryInput(page).fill(ingredient)
    await pantryInput(page).press('Enter')

    // Wait for the add request to complete and the list to update
    await page.waitForTimeout(800)
    await expect(page.getByRole('main').getByText(ingredient)).toBeVisible()
  })

  test('removing an ingredient removes it from the pantry list', async ({ page }) => {
    const ingredient = `remove-test-${Date.now()}`

    // Add the item first
    await pantryInput(page).fill(ingredient)
    await pantryInput(page).press('Enter')
    await page.waitForTimeout(800)
    await expect(page.getByRole('main').getByText(ingredient)).toBeVisible()

    // Remove it via the aria-label button
    const removeBtn = page.getByRole('button', { name: new RegExp(`Remove ${ingredient} from pantry`, 'i') })
    // Hover to make the button visible (opacity-0 by default, group-hover shows it)
    await page.getByRole('main').getByText(ingredient).hover()
    await removeBtn.click()

    await page.waitForTimeout(800)
    await expect(page.getByRole('main').getByText(ingredient)).not.toBeVisible()
  })
})

test.describe('Pantry — unauthenticated', () => {
  // Clear the project-level authenticated storageState for this block. The default
  // `page` fixture then carries no session, so middleware redirects to /login.
  // (browser.newContext() inherits the project storageState, so it stays logged in —
  // that was the original bug in this assertion.)
  test.use({ storageState: { cookies: [], origins: [] } })
  test.setTimeout(60000)

  test('unauthenticated /pantry redirects to /login', async ({ page }) => {
    await page.goto('/pantry')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})
