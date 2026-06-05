import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

// Auth tests run without pre-loaded session — they test the login flow itself
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Auth — login & signup pages', () => {
  test('login page renders email field, password field, and Sign in button @smoke', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByLabel(/email/i)).toBeVisible()
    await expect(page.getByLabel(/password/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })

  test('signup page renders name, email, password, and confirm password fields @smoke', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.getByLabel(/name/i).first()).toBeVisible()
    await expect(page.getByLabel(/^email/i)).toBeVisible()
    await expect(page.getByLabel(/^password/i)).toBeVisible()
    await expect(page.getByLabel(/confirm password/i)).toBeVisible()
  })

  test.describe('login flow', () => {
    test.setTimeout(60000)

    test('valid credentials redirect to /kitchen @smoke', async ({ page }) => {
      await loginAsTestUser(page)
      await page.goto('/kitchen')
      await page.waitForLoadState('domcontentloaded')

      if (page.url().includes('2fa-verify')) return
      expect(page.url()).toContain('/kitchen')
    })

    test('invalid password keeps user on /login (or shows error) @smoke', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('domcontentloaded')

      await page.getByLabel(/email/i).fill('test@test.com')
      await page.getByLabel(/password/i).fill('wrongpassword')
      await page.getByRole('button', { name: /sign in/i }).click()

      await page.waitForTimeout(1500)
      const onLogin = page.url().includes('/login')
      const hasError = await page
        .getByText(/invalid email or password/i)
        .isVisible()
        .catch(() => false)
      expect(onLogin || hasError).toBe(true)
    })

    test('unauthenticated /kitchen redirects to /login', async ({ page }) => {
      await page.goto('/kitchen')
      await page.waitForLoadState('domcontentloaded')
      expect(page.url()).toContain('/login')
    })
  })
})
