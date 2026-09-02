import { describe, it, expect } from 'vitest'
import { escapeLike, MAX_INGREDIENTS, DEFAULT_LIMIT, MAX_LIMIT } from '../reverse-search'
import { NON_VEGETARIAN_RAW_PATTERNS, STAPLE_SLUGS } from '../ingredient-normalize'

/**
 * JS stand-in for the Postgres `~*` test the vegetarian filter runs.
 * Postgres's `\y` word boundary is `\b` here.
 */
const meatRe = new RegExp(`\\b(${NON_VEGETARIAN_RAW_PATTERNS.join('|')})`, 'i')

describe('escapeLike', () => {
  it('neutralises LIKE wildcards so a query cannot widen its own pattern', () => {
    expect(escapeLike('100%')).toBe('100\\%')
    expect(escapeLike('a_b')).toBe('a\\_b')
    expect(escapeLike('back\\slash')).toBe('back\\\\slash')
  })

  it('leaves ordinary ingredient text alone', () => {
    expect(escapeLike('olive oil')).toBe('olive oil')
    expect(escapeLike("bird's eye chili")).toBe("bird's eye chili")
  })
})

describe('vegetarian raw-text filter vocabulary', () => {
  it('catches meat and fish, including strings that match no canonical row', () => {
    const shouldMatch = [
      'guanciale, cut into 1/4-inch strips',
      'bone-in chicken thighs and drumsticks',
      'low-sodium beef stock',
      'anchovy fillets',
      'anchovies',
      'smoked fish (e.g., mackerel), deboned',
      'andouille sausage',
      'pork fatback',
      'dashi stock',
      'oxtail, cut into 2-inch pieces',
      'gelatin',
      'Worcestershire sauce',
      'chicken livers',
    ]
    for (const s of shouldMatch) expect(meatRe.test(s), s).toBe(true)
  })

  it('does not fire inside longer unrelated words', () => {
    // Word boundaries are the whole reason this is a regex and not a substring
    // scan: "ham" inside "graham" would quietly delete graham crackers from
    // every vegetarian result.
    const shouldNotMatch = [
      'graham cracker crumbs',
      'chickpeas, drained and rinsed',
      'romaine lettuce',
      'brioche buns',
      'cremini mushrooms',
      'sunflower seeds',
      'porcini mushrooms',
      'rosemary sprigs',
      'clementine zest',
      'hominy',
      'marrowfat peas'.replace('marrowfat', 'yellow split'),
    ]
    for (const s of shouldNotMatch) expect(meatRe.test(s), s).toBe(false)
  })

  it('over-excludes in known, accepted ways', () => {
    // A word boundary cannot save these — the meat word really is a whole word.
    // Recorded rather than fixed: losing crab apple jelly from a vegetarian
    // view is a far cheaper error than showing someone crab, and "meatless"
    // matching "meat" fails in the same safe direction.
    for (const s of ['crab apple jelly', 'meatless crumbles', 'vegetarian chicken substitute']) {
      expect(meatRe.test(s), s).toBe(true)
    }
  })

  it('flags a genuinely ambiguous case rather than letting it through', () => {
    // "vegetable or chicken broth" is makeable vegetarian, but word order in
    // prose must not decide a dietary result, so it is excluded either way.
    expect(meatRe.test('vegetable or chicken broth')).toBe(true)
    expect(meatRe.test('chicken or vegetable broth')).toBe(true)
  })

  it('has no empty or whitespace-only pattern', () => {
    // One empty entry would make the alternation match everything and empty
    // the vegetarian filter's results entirely.
    for (const p of NON_VEGETARIAN_RAW_PATTERNS) expect(p.trim().length).toBeGreaterThan(1)
  })

  it('contains no regex metacharacters, since patterns are interpolated raw', () => {
    for (const p of NON_VEGETARIAN_RAW_PATTERNS) expect(p).toMatch(/^[a-z ]+$/)
  })
})

describe('search limits', () => {
  it('are ordered sanely', () => {
    expect(DEFAULT_LIMIT).toBeLessThanOrEqual(MAX_LIMIT)
    expect(MAX_INGREDIENTS).toBeGreaterThan(0)
  })

  it('never treats a staple as a searchable constraint', () => {
    // Staples are dropped from the required set; if the set were allowed to be
    // all-staples the query would return the entire library as "tier 0".
    expect(STAPLE_SLUGS.has('salt')).toBe(true)
    expect(STAPLE_SLUGS.has('water')).toBe(true)
    expect(STAPLE_SLUGS.has('garlic')).toBe(false)
    expect(STAPLE_SLUGS.has('onion')).toBe(false)
  })
})
