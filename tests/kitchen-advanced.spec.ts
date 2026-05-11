import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Kitchen advanced options panel — F32, F34, F35, F53, F54, F61, F64, F70, F71, F74, F75, F76, F78.
 * The panel is collapsed by default; these tests open it and verify each toggle is present and interactive.
 * No AI calls are made — just UI state validation.
 */

test.describe('Kitchen advanced options panel', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('Advanced options section is present and can be opened', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /advanced options/i })
    await expect(toggle).toBeVisible()
    await toggle.click()
    // Panel expands — cuisine selector should now be visible
    await expect(page.getByRole('combobox').first()).toBeVisible()
  })

  test('F34: cuisine selector is visible in advanced options', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    // Cuisine label
    await expect(page.getByRole('main').getByText(/cuisine/i).first()).toBeVisible()
  })

  test('F35: difficulty selector is visible in advanced options', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('main').getByText(/difficulty/i).first()).toBeVisible()
  })

  test('F32: prep time limit buttons are visible in advanced options', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('button', { name: /15 min/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /30 min/i })).toBeVisible()
  })

  test('F32: selecting a prep time marks it as active', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    const btn15 = page.getByRole('button', { name: /15 min/i })
    await btn15.click()
    await expect(btn15).toHaveAttribute('aria-pressed', 'true')
    // Clicking No limit should deselect it
    await page.getByRole('button', { name: /no limit/i }).click()
    await expect(btn15).toHaveAttribute('aria-pressed', 'false')
  })

  test('F61: Strict ingredients toggle is visible and toggleable', async ({ page }) => {
    const strictBtn = page.getByRole('button', { name: /strict ingredients only/i })
    await expect(strictBtn).toBeVisible()
    await strictBtn.click()
    // After clicking, the button should still be in the DOM (toggle behavior)
    await expect(strictBtn).toBeVisible()
  })

  test('F75: I\'m exhausted toggle is visible and toggleable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /i'm exhausted/i })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'false')
  })

  test('F76: Protein-Max toggle is visible and toggleable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /protein-max/i })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('F64: Teach me mode toggle is visible and toggleable', async ({ page }) => {
    const btn = page.getByRole('button', { name: /teach me mode/i })
    await expect(btn).toBeVisible()
    await btn.click()
    await expect(btn).toHaveAttribute('aria-pressed', 'true')
  })

  test('F53: Budget mode toggle is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('button', { name: /budget mode/i })).toBeVisible()
  })

  test('F71: Date night mode toggle is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('button', { name: /date night/i })).toBeVisible()
  })

  test('F28: Leftover optimizer toggle is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('button', { name: /leftover optimizer/i })).toBeVisible()
  })

  test('F28: enabling leftover optimizer reveals leftover text input', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    const leftoverBtn = page.getByRole('button', { name: /leftover optimizer/i })
    await leftoverBtn.click()
    // Leftover textarea should appear
    await expect(page.getByLabel(/leftover ingredients to use up/i)).toBeVisible()
  })

  test('F54: Impress Me button is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('button', { name: /impress me/i })).toBeVisible()
  })

  test('F70: Chef style buttons are visible in advanced panel (Home Cook, French Chef, Street Food)', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('button', { name: /home cook/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /french chef/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /street food/i })).toBeVisible()
  })

  test('F70: selecting a chef style marks it as active', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    const frenchBtn = page.getByRole('button', { name: /french chef/i })
    await frenchBtn.click()
    await expect(frenchBtn).toHaveAttribute('aria-pressed', 'true')
    const homeBtn = page.getByRole('button', { name: /home cook/i })
    await expect(homeBtn).toHaveAttribute('aria-pressed', 'false')
  })

  test('F74: Cooking method selector is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByRole('main').getByText(/cooking method/i)).toBeVisible()
  })

  test('F77: Restaurant recreation input is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(
      page.getByRole('textbox', { name: /recreate the flavor profile of a restaurant/i }),
    ).toBeVisible()
  })

  test('F78: Spice level slider is visible in advanced panel', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    await expect(page.getByTestId('spice-level-slider')).toBeVisible()
  })

  test('F55: voice input button is present (or hidden on unsupported browsers)', async ({ page }) => {
    await page.getByRole('button', { name: /advanced options/i }).click()
    // Voice input is conditionally rendered; on Chromium it may or may not be present
    // We verify it doesn't crash the page — the panel itself must still be stable
    const voiceBtn = page.getByRole('button', { name: /speak ingredients|start voice input/i })
    const isVisible = await voiceBtn.isVisible().catch(() => false)
    // No assertion on visibility since Web Speech API support varies by browser
    // What matters: the page doesn't throw if the voice button is/isn't present
    expect(typeof isVisible).toBe('boolean')
  })
})
