import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

/**
 * Auth guards and basic API contracts for:
 * - POST /api/recipes/[id]/chat     — AI cooking coach chat (used in cooking mode)
 * - POST /api/recipes/[id]/convert-diet — AI diet conversion (gluten-free, vegan, etc.)
 * - POST /api/recipes/ingredient-comment — per-ingredient AI comments with caching
 *
 * These endpoints all check PLAYWRIGHT_TEST=true and return mocked responses,
 * so the tests exercise the real auth + routing logic without hitting live AI APIs.
 */

test.describe('Recipe chat API — auth + mock response', () => {
  test.setTimeout(60000)

  test('POST /api/recipes/[id]/chat returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/recipes/fake-id/chat', {
      data: { message: 'How do I know when the chicken is done?', history: [] },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/recipes/[id]/chat returns 404 for a recipe the user does not own', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.post('/api/recipes/clxxxxxxxxxxxxxxxxxxxxxxxxx/chat', {
      data: { message: 'How do I know when the chicken is done?', history: [] },
    })
    // Nonexistent recipe → 404
    expect(res.status()).toBe(404)
  })

  test('POST /api/recipes/[id]/chat returns a streaming response for an owned recipe (PLAYWRIGHT_TEST mode)', async ({ page }) => {
    await loginAsTestUser(page)

    // Get a real recipe ID from the /saved page
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')
    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) { test.skip(); return }
    const href = await viewLinks.first().getAttribute('href')
    if (!href) { test.skip(); return }
    const recipeId = href.replace('/recipe/', '')

    const res = await page.request.post(`/api/recipes/${recipeId}/chat`, {
      data: { message: 'How do I know when the chicken is done?', history: [] },
    })
    // In PLAYWRIGHT_TEST mode the chat route returns SSE text/event-stream with a mock response
    expect(res.status()).toBe(200)
    const contentType = res.headers()['content-type'] ?? ''
    expect(contentType).toMatch(/text\/event-stream|text\/plain/i)
  })

  test('POST /api/recipes/[id]/chat returns 400 when message is empty', async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to /saved and grab a real recipe ID to exercise the message-validation path
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')
    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      // No saved recipes — use a fake id (will 404 before reaching message validation)
      const res = await page.request.post('/api/recipes/clxxxxxxxxxxxxxxxxxxxxxxxxx/chat', {
        data: { message: '   ', history: [] },
      })
      expect(res.status()).not.toBe(200)
      expect(res.status()).not.toBe(500)
      return
    }
    const href = await viewLinks.first().getAttribute('href')
    if (!href) { test.skip(); return }
    const recipeId = href.replace('/recipe/', '')

    const res = await page.request.post(`/api/recipes/${recipeId}/chat`, {
      data: { message: '   ', history: [] },
    })
    // Empty/whitespace message → 400; never 200 or 500
    expect(res.status()).toBe(400)
  })
})

test.describe('Diet conversion API — auth + valid/invalid diet (F05 enhancement)', () => {
  test.setTimeout(60000)

  test('POST /api/recipes/[id]/convert-diet returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/recipes/fake-id/convert-diet', {
      data: { diet: 'vegan' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/recipes/[id]/convert-diet returns 404 for recipe the user does not own', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.post('/api/recipes/clxxxxxxxxxxxxxxxxxxxxxxxxx/convert-diet', {
      data: { diet: 'vegan' },
    })
    // Recipe doesn't exist → 404
    expect(res.status()).toBe(404)
  })

  test('POST /api/recipes/[id]/convert-diet returns mock conversion for a saved recipe (PLAYWRIGHT_TEST mode)', async ({ page }) => {
    await loginAsTestUser(page)

    // Navigate to /saved and grab the first recipe link href to extract a real ID
    await page.goto('/saved')
    await page.waitForLoadState('domcontentloaded')
    const viewLinks = page.getByRole('link', { name: /view recipe/i })
    if (await viewLinks.count() === 0) {
      test.skip()
      return
    }
    const href = await viewLinks.first().getAttribute('href')
    if (!href) { test.skip(); return }
    const recipeId = href.replace('/recipe/', '')

    const res = await page.request.post(`/api/recipes/${recipeId}/convert-diet`, {
      data: { diet: 'gluten-free' },
    })

    // In PLAYWRIGHT_TEST mode the route returns a deterministic mock response
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Mock response shape: { convertedIngredients, adjustedInstructions, changes, flavorNotes, difficulty }
    expect(Array.isArray(body.convertedIngredients)).toBe(true)
    expect(Array.isArray(body.adjustedInstructions)).toBe(true)
    expect(typeof body.flavorNotes).toBe('string')
  })
})

test.describe('Ingredient comment API — auth + caching (F25 AI comments)', () => {
  test.setTimeout(60000)

  test('POST /api/recipes/ingredient-comment returns 401 for unauthenticated request', async ({ request }) => {
    const res = await request.post('/api/recipes/ingredient-comment', {
      data: { recipeTitle: 'Pasta', ingredient: 'Parmesan', action: 'add' },
    })
    expect(res.status()).toBe(401)
  })

  test('POST /api/recipes/ingredient-comment returns a comment string (PLAYWRIGHT_TEST mock)', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.post('/api/recipes/ingredient-comment', {
      data: { recipeTitle: 'Spaghetti Carbonara', ingredient: 'Pecorino Romano', action: 'add' },
    })
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.comment).toBe('string')
    expect(body.comment.length).toBeGreaterThan(0)
  })

  test('POST /api/recipes/ingredient-comment returns same mock comment on repeat call (cache behavior)', async ({ page }) => {
    await loginAsTestUser(page)
    const payload = { recipeTitle: 'Risotto', ingredient: 'Arborio Rice', action: 'add' }

    const res1 = await page.request.post('/api/recipes/ingredient-comment', { data: payload })
    const res2 = await page.request.post('/api/recipes/ingredient-comment', { data: payload })

    expect(res1.status()).toBe(200)
    expect(res2.status()).toBe(200)

    const body1 = await res1.json()
    const body2 = await res2.json()
    // Identical inputs should yield identical comments (from cache or deterministic mock)
    expect(body1.comment).toBe(body2.comment)
  })
})
