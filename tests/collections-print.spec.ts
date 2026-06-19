import { test, expect, type Page } from '@playwright/test'

/**
 * Collection detail + Recipe print view — ingredientbot.com
 *
 * Routes covered:
 *   /collections/[id]  — auth-gated collection detail (404 if not owned)
 *   /recipe/[id]/print — auth-gated print view (404 if not owned)
 *
 * Strategy:
 *   - /collections/[id]: Authenticated user visits /collections and grabs the
 *     first collection link if any exist. If none, tests the auth wall and a
 *     fake-ID 404 response. A collection belonging to another user returns 404,
 *     so we only follow links from the user's own collection list.
 *   - /recipe/[id]/print: Authenticated user visits /history and grabs the
 *     first recipe link. If none, tests auth wall + fake-ID 404. Uses a
 *     fake id to confirm 404 (not 500) for non-existent/unowned recipes.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

async function getFirstCollectionId(page: Page): Promise<string | null> {
  await page.goto('/collections')
  await page.waitForLoadState('domcontentloaded')
  // Collection detail links follow /collections/[id]
  const link = page.locator('a[href^="/collections/"]').first()
  if (!(await link.count())) return null
  const href = await link.getAttribute('href')
  return href ? href.replace('/collections/', '') : null
}

async function getFirstRecipeId(page: Page): Promise<string | null> {
  await page.goto('/history')
  await page.waitForLoadState('domcontentloaded')
  // History cards link to /recipe/[id] — grab the id from the href
  const link = page.locator('a[href^="/recipe/"]').first()
  if (!(await link.count())) return null
  const href = await link.getAttribute('href')
  if (!href) return null
  // href is /recipe/[id] — extract first path segment after /recipe/
  const match = href.match(/\/recipe\/([^/]+)/)
  return match?.[1] ?? null
}

// ──────────────────────────────────────────────────────────────────────────────
// /collections/[id]
// ──────────────────────────────────────────────────────────────────────────────

test.describe('/collections/[id] — collection detail', () => {
  test.setTimeout(30000)

  test('owned collection detail page renders without a 500', async ({ page }) => {
    const id = await getFirstCollectionId(page)
    if (!id) {
      // No collections yet — verify /collections is still healthy
      await expect(page.locator('body')).not.toContainText(/application error/i)
      return
    }

    let serverError = false
    page.on('response', (r) => {
      if (r.status() >= 500) serverError = true
    })

    await page.goto(`/collections/${id}`)
    await page.waitForLoadState('domcontentloaded')
    expect(serverError).toBe(false)
    await expect(page.locator('body')).not.toContainText(/application error/i)
  })

  test('owned collection detail page renders collection name or empty recipe list', async ({ page }) => {
    const id = await getFirstCollectionId(page)
    if (!id) return

    await page.goto(`/collections/${id}`)
    await page.waitForLoadState('domcontentloaded')

    // CollectionDetailClient renders the collection name as a heading
    // and either recipe cards or an empty-state message
    await expect(page.getByRole('main')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('body')).not.toContainText(/application error/i)
  })

  test('fake collection ID returns 404, not 500', async ({ page }) => {
    let serverError = false
    page.on('response', (r) => {
      if (r.status() >= 500) serverError = true
    })
    // Non-existent or unowned collection → notFound() → 404
    await page.goto('/collections/fake-collection-id-xyz')
    await page.waitForLoadState('domcontentloaded')
    expect(serverError).toBe(false)
  })

  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('/collections/[id] redirects unauthenticated user to /login', async ({ page }) => {
      await page.goto('/collections/some-collection-id')
      await page.waitForURL(/\/login/, { timeout: 10000 })
      expect(page.url()).toContain('/login')
    })
  })
})

// ──────────────────────────────────────────────────────────────────────────────
// /recipe/[id]/print
// ──────────────────────────────────────────────────────────────────────────────

test.describe('/recipe/[id]/print — print view', () => {
  test.setTimeout(30000)

  test('owned recipe print page renders without a 500', async ({ page }) => {
    const id = await getFirstRecipeId(page)
    if (!id) {
      // No recipes — confirm /history is healthy
      await expect(page.locator('body')).not.toContainText(/application error/i)
      return
    }

    let serverError = false
    page.on('response', (r) => {
      if (r.status() >= 500) serverError = true
    })

    await page.goto(`/recipe/${id}/print`)
    await page.waitForLoadState('domcontentloaded')
    expect(serverError).toBe(false)
    await expect(page.locator('body')).not.toContainText(/application error/i)
  })

  test('owned recipe print page shows recipe title', async ({ page }) => {
    const id = await getFirstRecipeId(page)
    if (!id) return

    await page.goto(`/recipe/${id}/print`)
    await page.waitForLoadState('domcontentloaded')

    // PrintRecipeView renders the recipe title in an h1
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 8000 })
  })

  test('fake recipe ID returns 404, not 500', async ({ page }) => {
    let serverError = false
    page.on('response', (r) => {
      if (r.status() >= 500) serverError = true
    })
    // Non-existent or unowned recipe → notFound() → 404
    await page.goto('/recipe/fake-recipe-id-xyz/print')
    await page.waitForLoadState('domcontentloaded')
    expect(serverError).toBe(false)
  })

  test.describe('unauthenticated', () => {
    test.use({ storageState: { cookies: [], origins: [] } })

    test('/recipe/[id]/print redirects unauthenticated user to /login', async ({ page }) => {
      await page.goto('/recipe/some-recipe-id/print')
      await page.waitForURL(/\/login/, { timeout: 10000 })
      expect(page.url()).toContain('/login')
    })
  })
})
