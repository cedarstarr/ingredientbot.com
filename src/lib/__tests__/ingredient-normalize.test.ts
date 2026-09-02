import { describe, it, expect } from 'vitest'
import {
  matchIngredient,
  candidateForms,
  slugifyIngredient,
  ADDITIONAL_INGREDIENTS,
  INGREDIENT_ALIASES,
  STAPLE_SLUGS,
} from '../ingredient-normalize'
import { DEFAULT_INPUTS } from '../../../scripts/seed-ingredient-ai'

/**
 * The canonical corpus as seeded by scripts/seed-ingredient-ai.ts, plus the
 * curated additions the backfill creates. Only the slugs these tests touch —
 * matchIngredient() takes the set as an argument precisely so it can be
 * exercised without a database.
 */
const CORPUS = new Set<string>([
  // The real seeded corpus, imported rather than transcribed: a hand-copied
  // list drifts, and these tests exist to catch aliases pointing at slugs that
  // do not exist — which a stale copy would either hide or invent.
  ...Object.values(DEFAULT_INPUTS).flat().map(slugifyIngredient),
  ...ADDITIONAL_INGREDIENTS.map((a) => slugifyIngredient(a.name)),
])

const slugOf = (raw: string) => matchIngredient(raw, CORPUS).slug

describe('matchIngredient', () => {
  it('matches a canonical name exactly', () => {
    expect(slugOf('garlic')).toBe('garlic')
    expect(slugOf('ground beef')).toBe('ground-beef')
  })

  it('strips prep clauses that trail a comma', () => {
    expect(slugOf('garlic cloves, minced')).toBe('garlic')
    expect(slugOf('yellow onion, finely chopped')).toBe('onion')
    expect(slugOf('unsalted butter, softened')).toBe('butter')
    expect(slugOf('fresh cilantro, chopped (for garnish)')).toBe('fresh-cilantro')
  })

  it('strips parentheticals', () => {
    expect(slugOf('ground beef (80/20)')).toBe('ground-beef')
    expect(slugOf('coconut milk (full-fat, canned)')).toBe('coconut-milk')
  })

  it('handles plurals, including "cloves" meaning garlic', () => {
    expect(slugOf('carrots')).toBe('carrot')
    expect(slugOf('large eggs')).toBe('egg')
    expect(slugOf('garlic cloves')).toBe('garlic')
    expect(slugOf('cherry tomatoes')).toBe('cherry-tomato')
  })

  it('keeps "cloves" alone as the spice, not garlic', () => {
    // Ambiguous in English; in a recipe ingredient list it is the spice.
    expect(slugOf('whole cloves')).toBe('ground-cloves')
    expect(slugOf('cloves')).toBe('ground-cloves')
  })

  it('does not strip qualifiers that are part of a canonical name', () => {
    // The cascade must match these BEFORE it tries removing "fresh"/"ground".
    expect(slugOf('fresh basil')).toBe('fresh-basil')
    expect(slugOf('ground cumin')).toBe('ground-cumin')
    expect(slugOf('white rice')).toBe('white-rice')
    expect(slugOf('dark chocolate')).toBe('dark-chocolate')
    expect(slugOf('half and half')).toBe('half-and-half')
  })

  it('distributes a shared head noun across "A or B <noun>"', () => {
    // The first option is "canola oil", not the bare word "canola", and the
    // author's first choice wins. For broth that means the recipe reads as
    // non-vegetarian, which is the conservative direction — it can only
    // exclude a recipe from a vegetarian filter, never wrongly offer one.
    expect(slugOf('canola or vegetable oil')).toBe('canola-oil')
    expect(slugOf('chicken or vegetable broth')).toBe('chicken-broth')
    expect(slugOf('beef or lamb stock')).toBe('beef-broth')
    expect(slugOf('ghee or vegetable oil')).toBe('ghee')
  })

  it('falls back to the first comma segment when the tail is prose', () => {
    expect(slugOf('oxtail, cut into 2-inch pieces')).toBe('beef-chuck-roast')
    expect(slugOf('eggplant, sliced into 1-inch rounds')).toBe('eggplant')
    expect(slugOf('scallions, white parts only, smashed')).toBe('green-onion')
  })

  it('treats juice, zest and wedges as the fruit', () => {
    expect(slugOf('fresh lemon juice')).toBe('lemon')
    expect(slugOf('lime wedges, for serving')).toBe('lime')
    expect(slugOf('lemon zest')).toBe('lemon')
  })

  it('collapses salt spellings onto one row — the corpus\'s most common ingredient', () => {
    // Regression: "no-salt-added" once contributed the word "salt" to the
    // qualifier vocabulary, so a bare "salt" row (624 occurrences in the
    // library) was discarded as a qualifier and matched nothing.
    for (const s of ['salt', 'fine sea salt', 'kosher salt', 'coarse sea salt', 'table salt']) {
      expect(slugOf(s), s).toBe('salt')
    }
  })

  it('drops trailing purpose clauses', () => {
    expect(slugOf('water for boiling')).toBe('water')
    expect(slugOf('vegetable oil (for frying)')).toBe('vegetable-oil')
  })

  it('drops trailing measure words', () => {
    expect(slugOf('fresh cilantro sprigs')).toBe('fresh-cilantro')
    expect(slugOf('celery ribs')).toBe('celery')
    expect(slugOf('fresh thyme sprigs')).toBe('fresh-thyme')
  })

  it('resolves one row per herb or spice, dried or fresh, whole or ground', () => {
    expect(slugOf('dried thyme')).toBe('fresh-thyme')
    expect(slugOf('cumin seeds')).toBe('ground-cumin')
    expect(slugOf('coriander seeds')).toBe('ground-coriander')
    expect(slugOf('cinnamon stick')).toBe('ground-cinnamon')
    expect(slugOf('turmeric powder')).toBe('turmeric')
  })

  it('normalizes accents and curly apostrophes', () => {
    expect(slugOf('jalapeño')).toBe('jalapeno')
    expect(slugOf('jalapeno')).toBe('jalapeno')
  })

  it('flags section headings, including ones carrying a bogus amount', () => {
    // isIngredientHeading() only catches amount-less rows; position is the
    // reliable signal, so "For the köfte" with an amount is still a heading.
    expect(matchIngredient('For the broth', CORPUS).isHeading).toBe(true)
    expect(matchIngredient('For the köfte', CORPUS).isHeading).toBe(true)
    expect(matchIngredient('For assembly', CORPUS).isHeading).toBe(true)
  })

  it('does not mistake a trailing "for serving" ingredient for a heading', () => {
    expect(matchIngredient('plain yogurt, for serving', CORPUS).isHeading).toBe(false)
    expect(slugOf('plain yogurt, for serving')).toBe('plain-yogurt')
  })

  it('flags equipment as non-food so it never counts as an extra ingredient', () => {
    expect(matchIngredient('bamboo skewers', CORPUS).isNonFood).toBe(true)
    expect(matchIngredient('kitchen twine', CORPUS).isNonFood).toBe(true)
    expect(matchIngredient('metal or soaked wooden skewers', CORPUS).isNonFood).toBe(true)
  })

  it('returns null rather than guessing when nothing fits', () => {
    expect(slugOf('guanciale')).toBeNull()
    expect(slugOf('')).toBeNull()
  })

  it('never returns a slug outside the supplied corpus', () => {
    const samples = [
      'garlic cloves, minced', 'boneless, skinless chicken thighs', 'EVOO',
      'dried guajillo chiles', 'unsalted butter, melted', 'salt and black pepper',
      'chicken or seafood stock', 'yukon gold or russet potatoes',
    ]
    for (const s of samples) {
      const slug = matchIngredient(s, CORPUS).slug
      if (slug !== null) expect(CORPUS.has(slug), `${s} -> ${slug}`).toBe(true)
    }
  })
})

describe('alias and staple vocabularies', () => {
  it('every alias points at a slug that exists in the corpus', () => {
    // A typo'd target is invisible at runtime — the alias just never fires.
    const orphans = Object.entries(INGREDIENT_ALIASES).filter(([, slug]) => !CORPUS.has(slug))
    expect(orphans).toEqual([])
  })

  it('no alias key shadows a canonical slug with a different target', () => {
    // An alias whose own name is also a canonical row silently redirects that
    // row's traffic elsewhere. Only one is deliberate: every salt spelling
    // folds onto `salt`, so recipes never split across two staple rows. The
    // `kosher-salt` glossary entry stays published; it just gains no links.
    const INTENTIONAL = new Set(['kosher salt'])
    const conflicts = Object.entries(INGREDIENT_ALIASES).filter(
      ([alias, slug]) =>
        !INTENTIONAL.has(alias) &&
        CORPUS.has(slugifyIngredient(alias)) &&
        slugifyIngredient(alias) !== slug,
    )
    expect(conflicts).toEqual([])
  })

  it('every staple exists in the corpus', () => {
    // A staple slug that matches no row would silently stop being free, and
    // every recipe containing it would gain a phantom extra ingredient.
    expect([...STAPLE_SLUGS].filter((s) => !CORPUS.has(s))).toEqual([])
  })

  it('curated additions have unique slugs', () => {
    const slugs = ADDITIONAL_INGREDIENTS.map((a) => slugifyIngredient(a.name))
    expect(slugs.length).toBe(new Set(slugs).size)
  })
})

describe('candidateForms', () => {
  it('orders the full phrase before its stripped forms', () => {
    const forms = candidateForms('fresh lemon juice')
    expect(forms[0]).toBe('fresh lemon juice')
    expect(forms).toContain('lemon juice')
  })

  it('returns nothing for a string made only of qualifiers', () => {
    expect(candidateForms('finely chopped')).toEqual([])
  })
})
