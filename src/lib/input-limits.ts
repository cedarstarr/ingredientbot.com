/**
 * Size/shape bounds for authenticated AI routes and the dietary profile (FOU-778).
 * Without them a caller can push up to the 4.5 MB body limit into a model prompt.
 *
 * chose reject-with-400 over silent truncation: a clipped list would quietly change what the
 * user asked for. `restrictions` / `dietary` (allergen-bearing) are deliberately NOT bounded
 * here — they are left for a separate, allergen-owner decision (see FOU-778 notes).
 */
import { z } from 'zod'

const shortText = (max: number) => z.string().max(max)
const stringList = (maxItems: number, maxLen: number) => z.array(z.string().max(maxLen)).max(maxItems)

export const generateInputSchema = z.object({
  ingredients: stringList(60, 100).optional(),
  expiringIngredients: stringList(60, 100).optional(),
  cuisine: shortText(60).optional(),
  leftovers: shortText(500).optional(),
  restaurantStyle: shortText(200).optional(),
  personalityPrompt: shortText(500).optional(),
  cookingMethod: shortText(60).optional(),
})

export const chatInputSchema = z.object({
  message: shortText(2000),
  // roles are enumerated so a forged `system` turn cannot enter the prompt
  history: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: shortText(4000) }))
    .max(50)
    .optional(),
})

export const substituteInputSchema = z.object({ missingIngredient: shortText(200) })

export const modifyInputSchema = z.object({
  action: shortText(60).optional(),
  targetMethod: shortText(60).optional(),
})

export const dietaryProfileInputSchema = z.object({
  cuisinePrefs: stringList(30, 60).optional(),
  dislikedIngredients: stringList(100, 100).optional(),
})

/** Validate only the bounded keys; unknown keys pass through untouched. */
export function exceedsLimits<T extends z.ZodType>(schema: T, data: unknown): boolean {
  return !schema.safeParse(data ?? {}).success
}
