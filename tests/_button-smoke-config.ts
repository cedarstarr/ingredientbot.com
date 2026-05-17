import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  timeout: 25000,
  workers: 1,
  retries: 0,
  reporter: [['json']],
  use: { headless: true, ignoreHTTPSErrors: false },
  projects: [{
    name: 'chromium',
    use: { ...devices['Desktop Chrome'] },
  }],
})
