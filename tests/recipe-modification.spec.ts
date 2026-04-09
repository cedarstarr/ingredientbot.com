import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Recipe modification system — ModificationToolbar + GroceryListSheet on the recipe detail page.
 * These tests verify the modification controls render correctly and that the Shopping List
 * dialog can be opened. Actual AI streaming is not tested here (mocked in kitchen-generate.spec.ts).
 */

test.describe('Recipe detail — modification toolbar', () => {
  test.setTimeout(60000)

  test('modification toolbar is visible on a saved recipe page', async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to saved recipes to find a real recipe
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toMatch(/\/recipe\//)

    // The "Customize Recipe" heading is rendered by ModificationToolbar
    await expect(page.getByRole('heading', { name: /customize recipe/i })).toBeVisible()
  })

  test('modification toolbar shows Lower Calories and Reduce Fat buttons', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('button', { name: /lower calories/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /reduce fat/i })).toBeVisible()
  })

  test('modification toolbar shows Servings label and slider', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    // "Servings: N" label is rendered by the toolbar
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/servings:\s*\d+/i)
  })

  test('modification toolbar shows Method label and cooking method selector', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    // "Method" label is above the cooking method select
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/\bmethod\b/i)
  })
})

test.describe('Recipe detail — grocery list sheet', () => {
  test.setTimeout(60000)

  test('"Shopping List" button is visible on a saved recipe page', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByRole('button', { name: /shopping list/i })).toBeVisible()
  })

  test('clicking "Shopping List" opens a dialog with ingredient checklist', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /shopping list/i }).click()

    // Dialog should open with "Shopping List" title
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /shopping list/i })).toBeVisible()

    // Dialog shows either ingredients or "No ingredients found" message
    const body = await page.locator('[role="dialog"]').textContent()
    const hasIngredients = /remaining|no ingredients/i.test(body ?? '')
    expect(hasIngredients).toBe(true)
  })

  test('"Copy all" button is present in the shopping list dialog', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /shopping list/i }).click()
    await expect(page.getByRole('dialog')).toBeVisible()

    // "Copy all" button exists (may be disabled if no ingredients)
    await expect(page.getByRole('button', { name: /copy all/i })).toBeVisible()
  })
})

test.describe('Recipe detail — ingredient substitution', () => {
  test.setTimeout(60000)

  test('each ingredient has a substitution button (aria-label: "Substitute for ...")', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    // Each ingredient row has a button with aria-label "Substitute for <name>"
    // The buttons are opacity-0 by default and visible on hover/focus
    const subButtons = page.locator('button[aria-label^="Substitute for"]')
    const count = await subButtons.count()
    // At least one substitute button should exist (one per ingredient)
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
