import { defineConfig, devices } from '@playwright/test'

const PORT = 3010
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://localhost:${PORT}`
const isPreview = !!process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      grepInvert: /@mobile/,
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 14'] },
      grep: /@mobile/,
    },
    {
      name: 'android',
      use: { ...devices['Pixel 5'] },
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
          timeout: 30000,
          env: { PORT: String(PORT), PLAYWRIGHT_TEST: 'true' },
        },
      }),
})
