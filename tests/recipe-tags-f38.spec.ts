import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * F38: Recipe tagging — auto by cuisine/protein/method + manual tag chips
 *      on the recipe detail page. PUT /api/recipes/[id]/tags persists changes.
 */

test.describe('Recipe detail — tags UI (F38)', () => {
  test.setTimeout(60000)

  test('recipe detail shows the tag row with an "Add tag" button', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    // RecipeTags renders an "Add tag" pill button (aria-label="Add tag")
    await expect(page.getByRole('button', { name: /^add tag$/i })).toBeVisible()
  })

  test('clicking "Add tag" reveals the new-tag input field', async ({ page }) => {
    await loginAsTestUser(page)
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')

    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }

    await viewLinks.first().click()
    await page.waitForLoadState('domcontentloaded')

    await page.getByRole('button', { name: /^add tag$/i }).click()

    // The Input has aria-label "New tag"
    const tagInput = page.getByLabel('New tag')
    await expect(tagInput).toBeVisible()
  })
})

test.describe('Recipe tags API (F38)', () => {
  test('PUT /api/recipes/[id]/tags requires authentication', async ({ request }) => {
    const res = await request.put('/api/recipes/fake-id/tags', {
      data: { tags: ['quick', 'easy'] },
    })
    expect(res.status()).not.toBe(200)
  })
})
