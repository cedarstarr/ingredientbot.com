import { test, expect } from '@playwright/test'

test.describe('Kitchen — ingredient adding', () => {
  test.beforeEach(async ({ page }) => {
    // Log in as test user
    const csrfRes = await page.request.get('/api/auth/csrf')
    const { csrfToken } = await csrfRes.json()

    await page.request.post('/api/auth/callback/credentials', {
      form: {
        csrfToken,
        email: 'test@test.com',
        password: 'Test1234!',
        callbackUrl: 'http://localhost:3010/kitchen',
      },
    })

    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
  })

  test('adds ingredient on Enter', async ({ page }) => {
    const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
    await input.fill('chicken')
    await input.press('Enter')
    await expect(page.getByText('chicken')).toBeVisible()
    await expect(input).toHaveValue('')
  })

  test('adds ingredient on comma', async ({ page }) => {
    const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
    await input.fill('garlic')
    await input.press(',')
    await expect(page.getByText('garlic')).toBeVisible()
    await expect(input).toHaveValue('')
  })

  test('ignores duplicate ingredients', async ({ page }) => {
    const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
    await input.fill('rice')
    await input.press('Enter')
    await input.fill('rice')
    await input.press('Enter')
    await expect(page.getByText('rice')).toHaveCount(1)
  })

  test('removes ingredient on X click', async ({ page }) => {
    const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
    await input.fill('onion')
    await input.press('Enter')
    await expect(page.getByText('onion')).toBeVisible()

    // Click the X button inside the onion badge
    await page.locator('span').filter({ hasText: 'onion' }).getByRole('button').click()
    await expect(page.getByText('onion')).not.toBeVisible()
  })

  test('Find Recipes button disabled with fewer than 2 ingredients', async ({ page }) => {
    const btn = page.getByRole('button', { name: /find recipes/i })
    await expect(btn).toBeDisabled()

    const input = page.getByPlaceholder('e.g. chicken, rice, garlic...')
    await input.fill('chicken')
    await input.press('Enter')
    await expect(btn).toBeDisabled()

    await input.fill('rice')
    await input.press('Enter')
    await expect(btn).toBeEnabled()
  })
})
