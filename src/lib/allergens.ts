/**
 * Canonical allergen vocabulary — union of the FDA top-9 and EU-14 declared
 * allergen lists, snake_case, shared between the Prisma schema comments, the
 * batch seed/backfill scripts (scripts/lib/allergen-verify.ts), and any UI that
 * renders `Recipe.allergens` / `Recipe.mayContain` / `Ingredient.allergenProfile`.
 *
 * Kept as a single source of truth so a seed script and a display component can
 * never drift into different spellings of the same allergen.
 */
export const ALLERGEN_VOCABULARY = [
  'milk',
  'eggs',
  'fish',
  'crustacean_shellfish',
  'tree_nuts',
  'peanuts',
  'wheat',
  'soybeans',
  'sesame',
  'gluten_cereals',
  'celery',
  'mustard',
  'lupin',
  'molluscs',
  'sulphites',
] as const;

export type Allergen = (typeof ALLERGEN_VOCABULARY)[number];

const ALLERGEN_SET: ReadonlySet<string> = new Set(ALLERGEN_VOCABULARY);

export function isAllergen(value: string): value is Allergen {
  return ALLERGEN_SET.has(value);
}

const ALLERGEN_LABELS: Record<Allergen, string> = {
  milk: 'Milk',
  eggs: 'Eggs',
  fish: 'Fish',
  crustacean_shellfish: 'Crustacean shellfish',
  tree_nuts: 'Tree nuts',
  peanuts: 'Peanuts',
  wheat: 'Wheat',
  soybeans: 'Soybeans',
  sesame: 'Sesame',
  gluten_cereals: 'Gluten cereals',
  celery: 'Celery',
  mustard: 'Mustard',
  lupin: 'Lupin',
  molluscs: 'Molluscs',
  sulphites: 'Sulphites',
};

/** Human label for display. Falls back to the raw value for anything outside the vocabulary. */
export function allergenLabel(value: string): string {
  return isAllergen(value) ? ALLERGEN_LABELS[value] : value;
}
