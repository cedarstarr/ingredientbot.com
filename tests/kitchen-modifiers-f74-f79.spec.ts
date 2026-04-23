import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Kitchen panel — newly built recipe modifiers.
 *
 * F74: Cooking method selector (Sheet Pan / Air Fryer / Slow Cooker / etc.) — persisted on User.
 * F75: "I'm exhausted" mode toggle — session only, prefers dump-and-wait recipes.
 * F76: Protein-Max mode — session only, forces 40g+ protein per serving.
 * F77: Restaurant recreation free-text input (max 120 chars) — session only.
 * F78: Spice level slider (Mild / Medium / Hot / Fire) — persisted on User as 0..3.
 * F79: Medical dietary flags (low-sodium / low-FODMAP / diabetes-friendly) — on /settings.
 *
 * These features all shipped together in the F74–F79 sprint (commits 28c39d5 → 0c27b83).
 */

test.describe('Kitchen — F74 cooking method selector', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows "Cooking method" label in the kitchen panel', async ({ page }) => {
    await expect(page.getByText('Cooking method', { exact: true })).toBeVisible()
  })

  test('cooking method dropdown opens and shows equipment options', async ({ page }) => {
    const label = page.getByText('Cooking method', { exact: true })
    await expect(label).toBeVisible()

    // The combobox sits inside the same wrapper as the label
    const trigger = label.locator('..').locator('[role="combobox"]')
    await trigger.click()
    await page.waitForTimeout(300)

    // At least these equipment options should be available
    await expect(page.getByRole('option', { name: /sheet pan/i })).toBeVisible()
    await expect(page.getByRole('option', { name: /air fryer/i })).toBeVisible()
    await expect(page.getByRole('option', { name: /slow cooker/i })).toBeVisible()

    // Close the dropdown
    await page.keyboard.press('Escape')
  })

  test('selecting a cooking method persists across reloads (persisted on User)', async ({ page }) => {
    const label = page.getByText('Cooking method', { exact: true })
    const trigger = label.locator('..').locator('[role="combobox"]')
    await trigger.click()
    await page.waitForTimeout(300)
    await page.getByRole('option', { name: /air fryer/i }).click()

    // Allow PATCH to fly
    await page.waitForTimeout(800)

    // Reload — the kitchen panel should hydrate with the saved value
    await page.reload()
    await page.waitForLoadState('networkidle')

    const triggerText = await page.getByText('Cooking method', { exact: true })
      .locator('..')
      .locator('[role="combobox"]')
      .textContent()
    expect(triggerText).toMatch(/air fryer/i)

    // Reset to "any" so this test does not affect other tests
    const resetTrigger = page.getByText('Cooking method', { exact: true })
      .locator('..')
      .locator('[role="combobox"]')
    await resetTrigger.click()
    await page.waitForTimeout(200)
    await page.getByRole('option', { name: /any method/i }).click()
  })
})

test.describe('Kitchen — F75 "I\'m exhausted" mode', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows the "I\'m exhausted" toggle button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /i'm exhausted/i })
    await expect(btn).toBeVisible()
  })

  test('clicking the toggle flips its aria-pressed state', async ({ page }) => {
    const btn = page.getByRole('button', { name: /i'm exhausted/i })
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    // Reset
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
  })
})

test.describe('Kitchen — F76 Protein-Max mode', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows the "Protein-Max (40g+)" toggle button', async ({ page }) => {
    const btn = page.getByRole('button', { name: /protein-max/i })
    await expect(btn).toBeVisible()
  })

  test('clicking the toggle flips aria-pressed', async ({ page }) => {
    const btn = page.getByRole('button', { name: /protein-max/i })
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    // Reset
    await btn.click()
  })
})

test.describe('Kitchen — F77 restaurant recreation', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows the restaurant style input with placeholder', async ({ page }) => {
    const input = page.getByPlaceholder(/recreate like chipotle/i)
    await expect(input).toBeVisible()
  })

  test('input enforces a 120-character maxLength', async ({ page }) => {
    const input = page.getByPlaceholder(/recreate like chipotle/i)
    // Type a long string — the browser respects maxlength="120"
    await input.fill('a'.repeat(200))
    const value = await input.inputValue()
    expect(value.length).toBeLessThanOrEqual(120)
    // Cleanup
    await input.fill('')
  })
})

test.describe('Kitchen — F78 spice level slider', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows the "Spice level" label and 4 stop labels (Mild..Fire)', async ({ page }) => {
    await expect(page.getByText('Spice level', { exact: true })).toBeVisible()
    // Stop labels render below the slider — at least the extremes must be present
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/mild/i)
    expect(body).toMatch(/fire/i)
  })

  test('slider has aria-label "Spice level"', async ({ page }) => {
    const slider = page.getByLabel('Spice level').first()
    await expect(slider).toBeVisible()
  })
})

test.describe('Kitchen prefs API — F74 cookingMethod and F78 spiceLevel', () => {
  test.setTimeout(60000)

  test('GET /api/user/kitchen-prefs returns cookingMethod and spiceLevel fields', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.get('/api/user/kitchen-prefs')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.cookingMethod).toBe('string')
    expect(typeof body.spiceLevel).toBe('number')
  })

  test('PATCH accepts and persists a valid cookingMethod', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/kitchen-prefs', {
      data: { cookingMethod: 'Sheet Pan' },
    })
    expect(res.status()).toBe(200)

    const readback = await page.request.get('/api/user/kitchen-prefs')
    const data = await readback.json()
    expect(data.cookingMethod).toBe('Sheet Pan')

    // Reset
    await page.request.patch('/api/user/kitchen-prefs', {
      data: { cookingMethod: 'any' },
    })
  })

  test('PATCH rejects an invalid cookingMethod with 400', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/kitchen-prefs', {
      data: { cookingMethod: 'Open-Fire-Roaster-9000' },
    })
    expect(res.status()).toBe(400)
  })

  test('PATCH accepts and persists a valid spiceLevel (0..3)', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/kitchen-prefs', {
      data: { spiceLevel: 2 },
    })
    expect(res.status()).toBe(200)

    const readback = await page.request.get('/api/user/kitchen-prefs')
    const data = await readback.json()
    expect(data.spiceLevel).toBe(2)

    // Reset
    await page.request.patch('/api/user/kitchen-prefs', {
      data: { spiceLevel: 0 },
    })
  })

  test('PATCH rejects an out-of-range spiceLevel with 400', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/kitchen-prefs', {
      data: { spiceLevel: 99 },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe('Settings — F79 medical dietary flags', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Dietary Profile shows the Medical subsection with three flag labels', async ({ page }) => {
    // The "Medical" heading appears inside the dietary profile card
    await expect(page.getByRole('heading', { name: /^medical$/i })).toBeVisible()
    await expect(page.getByText(/low-sodium/i).first()).toBeVisible()
    await expect(page.getByText(/low-fodmap/i).first()).toBeVisible()
    await expect(page.getByText(/diabetes-friendly/i).first()).toBeVisible()
  })

  test('shows the "not medical advice" disclaimer near the medical flags', async ({ page }) => {
    // Wait for settings heading so post-hydration dietary section content is present
    await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/not medical advice|consult your doctor/i)
  })

  test('each medical flag has an accessible checkbox', async ({ page }) => {
    // base-ui Checkbox renders a visible span[role=checkbox] plus a hidden form-compat input —
    // both carry the same accessible label, so we target the visible one with .first()
    await expect(page.getByLabel('Low-sodium').first()).toBeVisible()
    await expect(page.getByLabel('Low-FODMAP').first()).toBeVisible()
    await expect(page.getByLabel('Diabetes-friendly').first()).toBeVisible()
  })
})

test.describe('Dietary API — F79 medical flag round-trip', () => {
  test.setTimeout(60000)

  test('GET /api/user/dietary returns lowSodium, lowFodmap, diabetesFriendly fields', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.get('/api/user/dietary')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty('lowSodium')
    expect(body).toHaveProperty('lowFodmap')
    expect(body).toHaveProperty('diabetesFriendly')
    expect(typeof body.lowSodium).toBe('boolean')
    expect(typeof body.lowFodmap).toBe('boolean')
    expect(typeof body.diabetesFriendly).toBe('boolean')
  })

  test('PATCH /api/user/dietary persists medical flags', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/dietary', {
      data: {
        restrictions: [],
        cuisinePrefs: [],
        dislikedIngredients: [],
        lowSodium: true,
        lowFodmap: false,
        diabetesFriendly: true,
      },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.lowSodium).toBe(true)
    expect(body.lowFodmap).toBe(false)
    expect(body.diabetesFriendly).toBe(true)

    // Reset to all-false to keep test state clean
    await page.request.patch('/api/user/dietary', {
      data: {
        restrictions: [],
        cuisinePrefs: [],
        dislikedIngredients: [],
        lowSodium: false,
        lowFodmap: false,
        diabetesFriendly: false,
      },
    })
  })
})
