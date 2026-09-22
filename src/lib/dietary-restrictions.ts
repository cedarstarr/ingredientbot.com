/**
 * Restriction slugs where being wrong is a medical event rather than a
 * preference. Single source shared by the AI safety matcher
 * (hasAllergenRestriction in src/lib/ai.ts) and the settings UI
 * (src/components/settings/dietary-profile-section.tsx) so their vocabularies
 * cannot drift apart again — FOU-629: the UI offered 5 fewer allergens than
 * the matcher recognized (peanut, tree-nut, shellfish, fish, sesame), so
 * users with those allergies had no way to record them and the safety flag
 * never fired for them.
 *
 * 'keto'/'halal'/'paleo' etc. are deliberately absent — they carry no
 * allergen risk.
 */
export const ALLERGEN_RESTRICTIONS = [
  'gluten-free',
  'dairy-free',
  'nut-free',
  'peanut-free',
  'tree-nut-free',
  'egg-free',
  'soy-free',
  'shellfish-free',
  'fish-free',
  'sesame-free',
] as const

/**
 * Full toggle list for the dietary-profile settings UI, in display order.
 * Built from ALLERGEN_RESTRICTIONS rather than listing the "-free" slugs a
 * second time, so adding an allergen here always reaches both consumers.
 */
export const RESTRICTION_OPTIONS = [
  'vegan',
  'vegetarian',
  ...ALLERGEN_RESTRICTIONS,
  'low-carb',
  'keto',
  'paleo',
  'halal',
  'kosher',
] as const
