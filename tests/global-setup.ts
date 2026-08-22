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

  // Retry the login: the first attempt can lose its budget to a cold
  // Neon/Railway connection while sibling suites start concurrently.
  const AUTH_ATTEMPTS = 3
  try {
    for (let attempt = 1; attempt <= AUTH_ATTEMPTS; attempt++) {
      try {
        await page.goto(`${BASE_URL}/login`)
        await page.getByLabel(/email/i).fill('test@test.com')
        await page.getByLabel(/password/i).fill('Test1234!')
        await page.getByRole('button', { name: /sign in|log in/i }).click()

        // Wait for navigation to kitchen or dashboard — on cold start this can take 60+s
        // because the Railway DB proxy (PgBouncer) needs to establish a connection
        await page.waitForURL(/\/(kitchen|dashboard)/, { timeout: 120000, waitUntil: 'commit' })

        await context.storageState({ path: AUTH_FILE })
        console.error(`[global-setup] Auth state saved to ${AUTH_FILE}`)
        break
      } catch (err) {
        if (attempt === AUTH_ATTEMPTS) {
          // Deliberately fatal. The old code wrote an empty storageState here
          // so the config wouldn't error on a missing file — which turned one
          // clear failure into every auth'd test failing against the login
          // page, 3 retries each, until the suite blew its wall-clock cap and
          // emitted no report at all (2026-08-22: shkdwn + matchmymajor).
          throw new Error(
            `[global-setup] authentication failed after ${AUTH_ATTEMPTS} attempts: ${
              err instanceof Error ? err.message : String(err)
            }`
          )
        }
        console.error(`[global-setup] auth attempt ${attempt}/${AUTH_ATTEMPTS} failed, retrying:`, err)
        await page.waitForTimeout(attempt * 5000)
      }
    }
  } finally {
    await browser.close()
  }
}
