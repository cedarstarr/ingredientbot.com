import { defineConfig, devices } from '@playwright/test'

const PORT = 3010
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`
const isPreview = !!process.env.PLAYWRIGHT_BASE_URL
const isVercelPreview = baseURL.includes('vercel.app')

export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
    ...(isVercelPreview && process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': process.env.VERCEL_AUTOMATION_BYPASS_SECRET,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: './playwright/.auth/user.json' },
      grepInvert: /@mobile/,
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'], storageState: './playwright/.auth/user.json' },
      grep: /@mobile/,
    },
    {
      name: 'android',
      use: { ...devices['Pixel 5'], storageState: './playwright/.auth/user.json' },
      grep: /@mobile/,
    },
  ],

  ...(isPreview
    ? {}
    : {
        webServer: {
          command: 'PATH=$HOME/.nvm/versions/node/v20.20.0/bin:$PATH npm run start',
          port: PORT,
          reuseExistingServer: !process.env.CI,
          timeout: 90000,
          env: { PORT: String(PORT), PLAYWRIGHT_TEST: 'true' },
        },
      }),
})
