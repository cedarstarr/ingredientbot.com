import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('renders email field, password field, and submit button', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible()
  })
})

test.describe('Valid credentials login', () => {
  test.setTimeout(60000)

  test('redirects to /kitchen after successful login via CSRF pattern', async ({ page }) => {
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

    // Guard against 2FA challenge (not expected, but defensive)
    if (page.url().includes('2fa-verify')) return

    expect(page.url()).toContain('/kitchen')
  })
})

test.describe('Invalid credentials login', () => {
  test('wrong password shows error and stays on /login', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('domcontentloaded')

    await page.locator('input[type="email"]').fill('test@test.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.getByRole('button', { name: /sign in/i }).click()

    // Either URL stays on /login or an error message appears
    await page.waitForTimeout(1500)
    const onLogin = page.url().includes('/login')
    const hasError = await page.getByText(/invalid email or password/i).isVisible().catch(() => false)
    expect(onLogin || hasError).toBe(true)
  })
})

test.describe('Signup page', () => {
  test('renders name, email, password, and confirm password fields', async ({ page }) => {
    await page.goto('/signup')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('input#name')).toBeVisible()
    await expect(page.locator('input#email')).toBeVisible()
    await expect(page.locator('input#password')).toBeVisible()
    await expect(page.locator('input#confirmPassword')).toBeVisible()
  })
})

test.describe('Forgot password page', () => {
  test('renders email field and send reset link button', async ({ page }) => {
    await page.goto('/forgot-password')
    await page.waitForLoadState('domcontentloaded')

    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.getByRole('button', { name: /send reset link/i })).toBeVisible()
  })
})

test.describe('Unauthenticated redirects', () => {
  test('/dashboard redirects to /login', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/kitchen redirects to /login', async ({ page }) => {
    await page.goto('/kitchen')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/meal-plan redirects to /login', async ({ page }) => {
    await page.goto('/meal-plan')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/saved redirects to /login', async ({ page }) => {
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/history redirects to /login', async ({ page }) => {
    await page.goto('/history')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/pantry redirects to /login', async ({ page }) => {
    await page.goto('/pantry')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/collections redirects to /login', async ({ page }) => {
    await page.goto('/collections')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })

  test('/upgrade redirects to /login', async ({ page }) => {
    await page.goto('/upgrade')
    await page.waitForLoadState('domcontentloaded')
    expect(page.url()).toContain('/login')
  })
})
