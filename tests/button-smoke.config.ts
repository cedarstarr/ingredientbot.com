import type { Page } from '@playwright/test'

export interface ButtonSmokeRow {
  route: string
  cta: string
  fill?: (page: Page) => Promise<void>
  expectResultTestId?: string
}

// Homepage is a pure marketing page — "Start Cooking for Free" is a <Link href="/signup">.
// The core AI feature (split-panel kitchen) lives at /kitchen which is behind auth.
// No public form or API-triggering button exists. rows is empty intentionally.
export const rows: ButtonSmokeRow[] = []
