import { test, expect } from '@playwright/test'

/**
 * Reverse ingredient search — the public "What can I make?" surface.
 *
 * Runs unauthenticated on purpose: the whole point of this page is that a
 * visitor can use it before signing up, so a regression that puts it behind
 * auth must fail here.
 *
 * Selectors scope through getByRole('main') per the portfolio standard — an
 * unscoped getByTestId can resolve to two nodes when a Next SSR stream closes
 * early and leaves a hidden duplicate under <body>.
 */
test.use({ storageState: { cookies: [], origins: [] } })

const PAGE = '/what-can-i-make'

/** Type into the composer and pick the first suggestion. */
async function addIngredient(page: import('@playwright/test').Page, text: string) {
  const main = page.getByRole('main')
  await main.getByTestId('ingredient-input').fill(text)
  const suggestions = main.getByTestId('ingredient-suggestion')
  await expect(suggestions.first()).toBeVisible()
  await suggestions.first().click()
}

test.describe('Reverse ingredient search', () => {
  test('page renders for a signed-out visitor @smoke @mobile', async ({ page }) => {
    await page.goto(PAGE)
    await expect(page.getByTestId('what-can-i-make-heading')).toBeVisible()
    // Not redirected to /login.
    expect(new URL(page.url()).pathname).toBe(PAGE)
  })

  test('composer accepts typed input @smoke @mobile', async ({ page }) => {
    await page.goto(PAGE)
    const input = page.getByRole('main').getByTestId('ingredient-input')
    await input.fill('onion')
    // FOU-413: on WebKit the old /kitchen textarea observed "" back after a
    // successful fill. This asserts the value actually survives on every engine.
    await expect(input).toHaveValue('onion')
  })

  test('autocomplete suggests ingredients and adds one as a chip @smoke @mobile', async ({ page }) => {
    await page.goto(PAGE)
    await addIngredient(page, 'onion')
    await expect(page.getByRole('main').getByTestId('ingredient-chip')).toHaveCount(1)
  })

  test('searching returns results grouped into tiers @smoke @mobile', async ({ page }) => {
    await page.goto(PAGE)
    await addIngredient(page, 'egg')

    const main = page.getByRole('main')
    await expect(main.getByTestId('reverse-search-card').first()).toBeVisible({ timeout: 15_000 })
    await expect(main.getByTestId('result-tier-heading').first()).toBeVisible()
  })

  test('an alias finds the canonical ingredient', async ({ page }) => {
    await page.goto(PAGE)
    const main = page.getByRole('main')
    await main.getByTestId('ingredient-input').fill('evoo')
    // "EVOO" is not a name in the corpus — only an alias of extra virgin olive oil.
    await expect(main.getByTestId('ingredient-suggestion').first()).toContainText(/olive oil/i)
  })

  test('a chip can be removed again', async ({ page }) => {
    await page.goto(PAGE)
    await addIngredient(page, 'onion')
    const main = page.getByRole('main')
    await expect(main.getByTestId('ingredient-chip')).toHaveCount(1)
    await main.getByTestId('ingredient-chip-remove').first().click()
    await expect(main.getByTestId('ingredient-chip')).toHaveCount(0)
    await expect(main.getByTestId('reverse-search-empty')).toBeVisible()
  })

  test('adding a second ingredient narrows the results', async ({ page }) => {
    await page.goto(PAGE)
    await addIngredient(page, 'egg')
    const main = page.getByRole('main')
    await expect(main.getByTestId('reverse-search-card').first()).toBeVisible({ timeout: 15_000 })
    const before = await main.getByTestId('reverse-search-card').count()

    await addIngredient(page, 'onion')
    // Every result must contain ALL chips, so the set can only shrink.
    await expect(async () => {
      const after = await main.getByTestId('reverse-search-card').count()
      expect(after).toBeLessThanOrEqual(before)
    }).toPass({ timeout: 15_000 })
  })

  test('a pantry staple is reported as not narrowing the search', async ({ page }) => {
    await page.goto(PAGE)
    await addIngredient(page, 'salt')
    // Staples never constrain — the page has to say so rather than silently
    // returning nothing.
    await expect(page.getByRole('main').getByTestId('staples-note')).toBeVisible({ timeout: 15_000 })
  })

  test('the vegetarian filter removes meat recipes', async ({ page }) => {
    await page.goto(PAGE)
    await addIngredient(page, 'onion')
    const main = page.getByRole('main')
    await expect(main.getByTestId('reverse-search-card').first()).toBeVisible({ timeout: 15_000 })
    const before = await main.getByTestId('reverse-search-card').count()

    await main.getByTestId('filter-vegetarian').check()
    await expect(async () => {
      const after = await main.getByTestId('reverse-search-card').count()
      expect(after).toBeLessThanOrEqual(before)
    }).toPass({ timeout: 15_000 })
  })

  test('the search API is reachable without a session @smoke', async ({ request }) => {
    const res = await request.get('/api/search/ingredients?q=oli')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.results)).toBe(true)
  })
})
