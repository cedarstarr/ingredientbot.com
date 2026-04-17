import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F55: Voice input for ingredients — mic button in the kitchen panel.
 *      Web Speech API: tap mic, speak ingredients, transcript appended to input.
 *      Button hidden gracefully when browser unsupported (Playwright/Chromium does not
 *      ship with a working SpeechRecognition implementation, so the button may be hidden
 *      after the voiceSupported check fires on mount).
 *
 * F34: Cuisine selector — expanded to 14 cuisines (Thai, Italian, Mexican, Japanese,
 *      Indian, Mediterranean, French, American, Chinese, Korean, Middle Eastern, Greek,
 *      Vietnamese, Spanish). Added in feat(ingredientbot): cuisine selector (F34).
 */

test.describe('Kitchen — voice input button (F55)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
    // Wait for voiceSupported check to fire after hydration
    await page.waitForTimeout(500)
  })

  test('mic button is present in the ingredient input row or gracefully hidden', async ({ page }) => {
    // The mic button renders by default (voiceSupported=true SSR) then may hide
    // if SpeechRecognition is unavailable. Either state is valid UX.
    const micBtn = page.getByRole('button', { name: /start voice input|stop recording/i })
    const isPresent = await micBtn.isVisible().catch(() => false)

    if (!isPresent) {
      // Graceful hidden fallback — voiceSupported was set to false after mount
      // Verify the input field is still accessible without voice
      const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
      await expect(input).toBeVisible()
    } else {
      // Mic button is visible — verify it has correct aria-label
      await expect(micBtn).toHaveAttribute('aria-label', /start voice input|stop recording/i)
    }
  })

  test('ingredient text input is always accessible regardless of voice support', async ({ page }) => {
    const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
    await expect(input).toBeVisible()
    await input.fill('basil')
    await expect(input).toHaveValue('basil')
  })

  test('hint text below input confirms how to add ingredients', async ({ page }) => {
    // "Press Enter or comma to add" or "Listening… speak your ingredients"
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/press enter|comma to add|listening/i)
  })
})

test.describe('Kitchen — cuisine selector expanded options (F34)', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('cuisine dropdown trigger is visible', async ({ page }) => {
    // The cuisine label is present and the Select trigger renders
    const cuisineLabel = page.getByText('Cuisine', { exact: true })
    await expect(cuisineLabel).toBeVisible()
  })

  test('opening cuisine dropdown shows at least 10 cuisine options', async ({ page }) => {
    // Find the Cuisine section and click its Select trigger
    const cuisineLabel = page.getByText('Cuisine', { exact: true })
    await expect(cuisineLabel).toBeVisible()

    // The combobox sits directly after the label
    const trigger = cuisineLabel.locator('..').locator('[role="combobox"]')
    await trigger.click()

    // After opening, options render in a listbox
    await page.waitForTimeout(300)
    const options = page.locator('[role="option"]')
    const count = await options.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('cuisine dropdown includes Asian cuisines added in F34 expansion', async ({ page }) => {
    const cuisineLabel = page.getByText('Cuisine', { exact: true })
    await expect(cuisineLabel).toBeVisible()
    const trigger = cuisineLabel.locator('..').locator('[role="combobox"]')
    await trigger.click()
    await page.waitForTimeout(300)

    // Thai, Japanese, Chinese, Korean were added in the F34 expansion commit
    const body = await page.locator('body').textContent()
    expect(body).toMatch(/thai/i)
    expect(body).toMatch(/japanese/i)
    expect(body).toMatch(/chinese/i)
    expect(body).toMatch(/korean/i)

    // Close the dropdown
    await page.keyboard.press('Escape')
  })

  test('cuisine dropdown includes "Any cuisine" as default option', async ({ page }) => {
    const cuisineLabel = page.getByText('Cuisine', { exact: true })
    const trigger = cuisineLabel.locator('..').locator('[role="combobox"]')
    await trigger.click()
    await page.waitForTimeout(300)

    await expect(page.getByRole('option', { name: /any cuisine/i })).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('selecting a cuisine updates the trigger display', async ({ page }) => {
    const cuisineLabel = page.getByText('Cuisine', { exact: true })
    const trigger = cuisineLabel.locator('..').locator('[role="combobox"]')
    await trigger.click()
    await page.waitForTimeout(300)

    // Select "Thai"
    const thaiOption = page.getByRole('option', { name: /^thai$/i })
    await thaiOption.click()
    await page.waitForTimeout(300)

    // The trigger should now show "Thai"
    const triggerText = await trigger.textContent()
    expect(triggerText).toMatch(/thai/i)
  })
})
