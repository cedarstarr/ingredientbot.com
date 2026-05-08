import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Pantry journey — F44 persistent pantry, F26 expiry badges.
 * Tests the core user flow: visit pantry, add an item, verify it appears, remove it.
 */

test.describe('Pantry journey (F44)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/pantry')
    await page.waitForLoadState('domcontentloaded')
  })

  test('pantry page loads and shows the add-to-pantry input', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByPlaceholder(/olive oil, garlic, pasta/i)).toBeVisible()
  })

  test('adding an ingredient appends it to the pantry list', async ({ page }) => {
    const ingredient = `test-item-${Date.now()}`

    await page.getByPlaceholder(/olive oil, garlic, pasta/i).fill(ingredient)
    await page.getByPlaceholder(/olive oil, garlic, pasta/i).press('Enter')

    // Wait for the add request to complete and the list to update
    await page.waitForTimeout(800)
    await expect(page.getByRole('main').getByText(ingredient)).toBeVisible()
  })

  test('removing an ingredient removes it from the pantry list', async ({ page }) => {
    const ingredient = `remove-test-${Date.now()}`

    // Add the item first
    await page.getByPlaceholder(/olive oil, garlic, pasta/i).fill(ingredient)
    await page.getByPlaceholder(/olive oil, garlic, pasta/i).press('Enter')
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

  test('unauthenticated /pantry redirects to /login', async ({ page: anonPage }) => {
    await anonPage.goto('/pantry')
    await anonPage.waitForLoadState('domcontentloaded')
    expect(anonPage.url()).toContain('/login')
  })
})
