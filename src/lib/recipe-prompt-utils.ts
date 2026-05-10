// Shared prompt-building helpers for the recipe routes.
// Extracted from src/app/api/recipes/generate/route.ts (and previously duplicated
// inline in src/app/api/recipes/cook/route.ts) so both routes use the exact same
// system-prompt injections and the logic is unit-testable in isolation.

// F74: cooking method constraint — equipment-specific instructions
export function buildCookingMethodContext(method: unknown): string {
  if (typeof method !== 'string' || !method || method === 'any') return ''
  switch (method) {
    case 'Sheet Pan':
      return `\n\nSHEET PAN: All ingredients should cook on a single sheet pan in the oven. No separate pots or pans.`
    case 'One-Pot':
      return `\n\nONE-POT: All cooking must happen in a single pot/pan for minimal cleanup.`
    case 'Air Fryer':
      return `\n\nAIR FRYER: Recipe must be cookable entirely in a standard air fryer. No stovetop or oven.`
    case 'Slow Cooker':
      return `\n\nSLOW COOKER: Recipe must work in a slow cooker / Crock-Pot. Dump-and-wait style.`
    case 'Instant Pot':
      return `\n\nINSTANT POT: Recipe must use a pressure cooker / Instant Pot. Include pressure-release timing.`
    case 'Microwave Only':
      return `\n\nMICROWAVE ONLY: All cooking steps must be doable in a standard microwave. No stovetop, no oven.`
    case 'No Stove':
      return `\n\nNO STOVE: Do not use the stovetop or oven — assume they're unavailable. Oven-free, stovetop-free.`
    default:
      return ''
  }
}

// F78: spice level 0..3 — always inject so AI doesn't default to "medium".
// Non-integer / out-of-range inputs clamp to the nearest valid level (default 0=Mild).
export function buildSpiceContext(level: unknown): string {
  const n = typeof level === 'number' && Number.isInteger(level) ? level : 0
  const clamped = Math.max(0, Math.min(3, n))
  const label = ['Mild', 'Medium', 'Hot', 'Fire'][clamped]
  return `\n\nSPICE LEVEL: ${label}. Calibrate heat accordingly — use appropriate chiles, peppers, and spices. Do not exceed this level.`
}
