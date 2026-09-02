import { test, expect } from '@playwright/test'

/**
 * "Cook this" — copying a public library recipe into your own collection so the
 * owner-scoped AI modifiers can run on it.
 *
 * PINNED to one slug on purpose. Forking is metered against the 5-a-month free
 * cap and the test user is not Pro, so forking a different recipe each run would
 * drain the quota in five runs and then fail forever. The fork route answers
 * "already forked?" BEFORE it checks the quota, so this recipe is copied exactly
 * once in the life of the database and every later run reuses that copy — which
 * also means these tests keep passing after the user hits the cap, as they should.
 */
const SLUG = 'dolmades'

test.describe('Cook this — library recipe fork', () => {
  test.describe('signed out', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('the CTA is visible to anyone @smoke @mobile', async ({ page }) => {
      await page.goto(`/r/${SLUG}`)
      await expect(page.getByRole('main').getByTestId('cook-this')).toBeVisible()
    })

    test('clicking it sends a signed-out visitor to log in', async ({ page }) => {
      await page.goto(`/r/${SLUG}`)
      await page.getByRole('main').getByTestId('cook-this').click()
      await page.waitForURL(/\/login/, { timeout: 15_000 })
      // ...and back to this recipe afterwards, not to a generic landing page.
      expect(decodeURIComponent(page.url())).toContain(`/r/${SLUG}`)
    })
  })

  test.describe('signed in', () => {
    test('forking opens the user\'s own copy, with the modifiers available @smoke', async ({ page }) => {
      await page.goto(`/r/${SLUG}`)
      await page.getByRole('main').getByTestId('cook-this').click()
      await page.waitForURL(/\/recipe\/[a-z0-9]+/, { timeout: 30_000 })
      expect(page.url()).toMatch(/\/recipe\/[a-z0-9]+/)

      // The whole point of forking: the AI modifier toolbar is owner-scoped, so
      // it can only appear once the visitor owns a copy. If this is missing, the
      // fork achieved nothing.
      await expect(page.getByRole('main').getByTestId('modification-toolbar')).toBeVisible({
        timeout: 15_000,
      })
    })

    test('forking the same recipe twice reuses the copy rather than spending quota', async ({ page }) => {
      await page.goto(`/r/${SLUG}`)
      await page.getByRole('main').getByTestId('cook-this').click()
      await page.waitForURL(/\/recipe\/[a-z0-9]+/, { timeout: 30_000 })
      const first = page.url()

      await page.goto(`/r/${SLUG}`)
      await page.getByRole('main').getByTestId('cook-this').click()
      await page.waitForURL(/\/recipe\/[a-z0-9]+/, { timeout: 30_000 })

      // A second copy would silently cost another of the five free recipes.
      expect(page.url()).toBe(first)
    })
  })

  test('the fork endpoint rejects an anonymous caller', async ({ request }) => {
    const res = await request.post('/api/recipes/does-not-matter/fork', {
      headers: { cookie: '' },
    })
    expect([401, 404]).toContain(res.status())
  })
})
