/**
 * Playwright global setup — runs once before all test workers start.
 *
 * 1. Authenticates as test@test.com via a full browser session.
 * 2. Saves the resulting auth cookies to playwright/.auth/user.json.
 * 3. All authenticated tests load this storageState, skipping the login
 *    form entirely. This eliminates 2+ Railway DB round-trips per test,
 *    cutting total suite time significantly and removing cold-start login
 *    timeouts that cause flaky failures.
 */

import { chromium } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3010'

export const AUTH_FILE = path.join(process.cwd(), 'playwright', '.auth', 'user.json')

export default async function globalSetup() {
  // Ensure the auth directory exists
  const authDir = path.dirname(AUTH_FILE)
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true })
  }

  const browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()

  try {
    await page.goto(`${BASE_URL}/login`)
    await page.getByLabel(/email/i).fill('test@test.com')
    await page.getByLabel(/password/i).fill('Test1234!')
    await page.getByRole('button', { name: /sign in|log in/i }).click()

    // Wait for navigation to kitchen or dashboard — on cold start this can take 60+s
    // because the Railway DB proxy (PgBouncer) needs to establish a connection
    await page.waitForURL(/\/(kitchen|dashboard)/, { timeout: 120000, waitUntil: 'commit' })

    await context.storageState({ path: AUTH_FILE })
    console.log(`[global-setup] Auth state saved to ${AUTH_FILE}`)
  } catch (err) {
    console.error('[global-setup] Authentication failed:', err)
    // Write empty storageState so project storageState config doesn't error on missing file
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))
  } finally {
    await browser.close()
  }
}
