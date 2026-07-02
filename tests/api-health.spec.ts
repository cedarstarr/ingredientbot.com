import { test, expect } from '@playwright/test'

/**
 * API smoke tests — minimal surface to catch a broken middleware or
 * misconfigured NextAuth without spinning up a full UI. Detail-route
 * shape (kitchen-prefs, dietary, recipes/tags) is covered by Vitest +
 * MSW in __tests__/.
 */

test.describe('API smoke', () => {
  test('GET /api/health returns 200 with status ok @smoke', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })

  test('GET /api/auth/csrf returns a csrfToken', async ({ request }) => {
    const res = await request.get('/api/auth/csrf')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.csrfToken).toBe('string')
    expect(body.csrfToken.length).toBeGreaterThan(0)
  })

})

// These assert the UNAUTHENTICATED behavior of protected routes. The `request`
// fixture inherits the project storageState (authenticated test user), so without
// clearing it these POSTs run authenticated and return 200 — masking the auth gate.
test.describe('API smoke — unauthenticated', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('protected route returns non-200 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/recipes/generate', {
      data: { ingredients: ['chicken', 'rice'] },
    })
    expect(res.status()).not.toBe(200)
  })

  test('signout-all rejects unauthenticated requests', async ({ request }) => {
    const res = await request.post('/api/auth/signout-all')
    expect(res.status()).not.toBe(200)
    expect([401, 403]).toContain(res.status())
  })
})
