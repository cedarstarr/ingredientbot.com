import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
    },
  ],
  webServer: {
    command: 'PATH=$HOME/.nvm/versions/node/v20.20.0/bin:$PATH npm run dev -- --port 3010',
    port: 3010,
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
    env: { PLAYWRIGHT_TEST: 'true' },
  },
})
