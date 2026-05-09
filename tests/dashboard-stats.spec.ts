import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Dashboard stats panel — F47 (cooking streak + monthly count) and F69 (heatmap).
 * These UI sections render for every user regardless of whether they have any
 * completions — they display zeros on a fresh account, so no seed data required.
 */

test.describe('Dashboard cooking stats (F47, F69)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
  })

  test('dashboard loads without error and shows welcome heading', async ({ page }) => {
    const res = await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    expect(res?.status()).not.toBe(500)
    // The heading "Welcome back" or "Welcome back, Name"
    await expect(page.getByRole('main').getByText(/welcome back/i)).toBeVisible()
  })

  test('F47: recipes-cooked-this-month stat card is visible', async ({ page }) => {
    // The stat label "Recipes cooked this month" is always rendered — value is 0 on a
    // fresh staging account, which is fine; we just verify the section is present.
    await expect(
      page.getByRole('main').getByText(/recipes cooked this month/i),
    ).toBeVisible()
  })

  test('F47: current cooking streak stat card is visible', async ({ page }) => {
    await expect(
      page.getByRole('main').getByText(/current cooking streak/i),
    ).toBeVisible()
  })

  test('F47: longest streak ever stat card is visible', async ({ page }) => {
    await expect(
      page.getByRole('main').getByText(/longest streak ever/i),
    ).toBeVisible()
  })

  test('F69: cooking activity heatmap section is present', async ({ page }) => {
    // The heatmap always renders its header and legend regardless of completion data.
    await expect(
      page.getByRole('main').getByText(/cooking activity/i),
    ).toBeVisible()
    // Legend labels
    await expect(page.getByRole('main').getByText(/^less$/i)).toBeVisible()
    await expect(page.getByRole('main').getByText(/^more$/i)).toBeVisible()
  })

  test('dashboard quick-action buttons are visible (Go to Kitchen, View All)', async ({ page }) => {
    await expect(page.getByRole('link', { name: /go to kitchen/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /view all/i }).first()).toBeVisible()
  })
})
