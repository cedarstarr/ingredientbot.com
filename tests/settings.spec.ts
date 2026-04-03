import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('Settings page', () => {
  test.setTimeout(60000)

  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/settings')
    await page.waitForLoadState('domcontentloaded')
  })

  test('shows "Settings" heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /^settings$/i })).toBeVisible()
  })

  test('shows the logged-in email address', async ({ page }) => {
    await expect(page.getByText('test@test.com')).toBeVisible()
  })

  test('shows Account section with email and name', async ({ page }) => {
    // "Email:" and "Name:" labels are in the account card
    const body = await page.locator('body').textContent()
    expect(body).toContain('Email:')
    expect(body).toContain('Name:')
  })

  test('shows Profile section with Display Name input', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /profile/i })).toBeVisible()
    await expect(page.locator('input#name')).toBeVisible()
    await expect(page.getByRole('button', { name: /save name/i })).toBeVisible()
  })

  test('shows Change Password section with password fields', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /change password/i })).toBeVisible()
    await expect(page.locator('input#currentPassword')).toBeVisible()
    await expect(page.locator('input#newPassword')).toBeVisible()
    await expect(page.locator('input#confirmNewPassword')).toBeVisible()
    await expect(page.getByRole('button', { name: /update password/i })).toBeVisible()
  })

  test('shows Email Notifications section with checkboxes', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /email notifications/i })).toBeVisible()
    // Marketing and product checkboxes
    const checkboxes = page.locator('input[type="checkbox"]')
    await expect(checkboxes.first()).toBeVisible()
    await expect(page.getByRole('button', { name: /save preferences/i })).toBeVisible()
  })

  test('shows Sessions section with "Sign Out All Devices" button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /sessions/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /sign out all devices/i })).toBeVisible()
  })

  test('shows Danger Zone section with Delete Account button', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /danger zone/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /delete account/i })).toBeVisible()
  })

  test('clicking Delete Account opens a confirmation dialog', async ({ page }) => {
    await page.getByRole('button', { name: /delete account/i }).click()
    // Dialog title should appear
    await expect(page.getByRole('dialog')).toBeVisible()
    await expect(page.getByRole('heading', { name: /delete account/i })).toBeVisible()
    // Confirm button should be disabled until password is entered
    const confirmBtn = page.getByRole('button', { name: /delete my account/i })
    await expect(confirmBtn).toBeDisabled()
  })

  test('mismatched new passwords shows client-side error', async ({ page }) => {
    await page.locator('input#currentPassword').fill('Test1234!')
    await page.locator('input#newPassword').fill('NewPass123!')
    await page.locator('input#confirmNewPassword').fill('Different456!')
    await page.getByRole('button', { name: /update password/i }).click()
    await expect(page.getByText(/passwords do not match/i)).toBeVisible()
  })
})
