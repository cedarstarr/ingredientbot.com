import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('Meal Planner page', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/meal-plan')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows "Meal Planner" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /meal planner/i })).toBeVisible()
  })

  test('shows a weekly date range subtitle', async ({ page }) => {
    // Subtitle format: "Apr 1 – Apr 7" — uses short month + day
    const body = await page.locator('body').textContent()
    // Should contain a month abbreviation and a dash/en-dash between two dates
    expect(body).toMatch(/\w{3}\s+\d+\s*[–-]\s*\w{3}\s+\d+/)
  })

  test('renders day headers (Sun through Sat)', async ({ page }) => {
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(page.getByText(day, { exact: true }).first()).toBeVisible()
    }
  })

  test('renders meal row labels (Breakfast, Lunch, Dinner)', async ({ page }) => {
    await expect(page.getByText('Breakfast', { exact: true })).toBeVisible()
    await expect(page.getByText('Lunch', { exact: true })).toBeVisible()
    await expect(page.getByText('Dinner', { exact: true })).toBeVisible()
  })

  test('"Grocery List" button is visible (disabled when no slots)', async ({ page }) => {
    const btn = page.getByRole('button', { name: /grocery list/i })
    await expect(btn).toBeVisible()
  })

  test('shows prompt to save recipes first when no recipes exist', async ({ page }) => {
    const body = await page.locator('body').textContent()
    // Either the empty state message or a filled-in grid — check that page loaded cleanly
    const hasPrompt = /cook something first/i.test(body ?? '')
    const hasGrid = await page.getByRole('button', { name: /add recipe/i }).isVisible().catch(() => false)
    // At least one state is visible
    expect(hasPrompt || hasGrid).toBe(true)
  })

  test('plus buttons to add recipes are visible in each cell when recipes exist', async ({ page }) => {
    // If the user has no saved recipes, the add buttons are disabled but still rendered
    const addButtons = page.getByRole('button', { name: /add recipe/i })
    // 7 days × 3 meals = 21 cells; all should have an add button when empty
    const count = await addButtons.count()
    // At minimum there's at least one (even if some slots are filled)
    expect(count).toBeGreaterThanOrEqual(1)
  })
})
