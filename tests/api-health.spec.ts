import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './helpers'

test.describe('API health endpoint', () => {
  test('GET /api/health returns 200 with status ok', async ({ request }) => {
    const res = await request.get('/api/health')
    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(typeof body.timestamp).toBe('string')
  })
})

test.describe('API auth endpoints — unauthenticated smoke checks', () => {
  test('GET /api/auth/csrf returns a csrfToken', async ({ request }) => {
    const res = await request.get('/api/auth/csrf')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.csrfToken).toBe('string')
    expect(body.csrfToken.length).toBeGreaterThan(0)
  })

  test('GET /api/auth/session returns empty session for unauthenticated user', async ({ request }) => {
    const res = await request.get('/api/auth/session')
    expect(res.status()).toBe(200)
    const body = await res.json()
    // Unauthenticated session is either null or an empty object
    expect(body === null || (typeof body === 'object' && !body.user)).toBe(true)
  })
})

test.describe('Protected API routes — unauthenticated', () => {
  test('GET /api/user/profile returns 401 or redirects when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/user/profile')
    // Should return 401 Unauthorized (or 403), not 200
    expect(res.status()).not.toBe(200)
  })

  test('GET /api/user/notifications returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/user/notifications')
    expect(res.status()).not.toBe(200)
  })

  test('POST /api/recipes/generate returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.post('/api/recipes/generate', {
      data: { ingredients: ['chicken', 'rice'] },
    })
    expect(res.status()).not.toBe(200)
  })

  test('GET /api/user/kitchen-prefs returns 401 when unauthenticated', async ({ request }) => {
    const res = await request.get('/api/user/kitchen-prefs')
    expect(res.status()).not.toBe(200)
  })
})

test.describe('Kitchen preferences API — authenticated (F53, F70)', () => {
  test.setTimeout(60000)

  test('GET /api/user/kitchen-prefs returns budgetMode and chefPersonality', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.get('/api/user/kitchen-prefs')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(typeof body.budgetMode).toBe('boolean')
    expect(typeof body.chefPersonality).toBe('string')
  })

  test('PATCH /api/user/kitchen-prefs updates chefPersonality', async ({ page }) => {
    await loginAsTestUser(page)

    const res = await page.request.patch('/api/user/kitchen-prefs', {
      data: { chefPersonality: 'french' },
    })
    expect(res.status()).toBe(200)

    // Verify the change was persisted
    const readback = await page.request.get('/api/user/kitchen-prefs')
    const data = await readback.json()
    expect(data.chefPersonality).toBe('french')

    // Reset to default
    await page.request.patch('/api/user/kitchen-prefs', {
      data: { chefPersonality: 'home' },
    })
  })

  test('PATCH /api/user/kitchen-prefs rejects an invalid chefPersonality', async ({ page }) => {
    await loginAsTestUser(page)
    const res = await page.request.patch('/api/user/kitchen-prefs', {
      data: { chefPersonality: 'robot-overlord' },
    })
    expect(res.status()).toBe(400)
  })
})
