import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";

// Per-feature cache TTLs. Suggestions are cheap to regenerate but most
// expensive on aggregate volume; photos are bytes-keyed and stable for a day;
// comments are deterministic for the same (action, ingredient, recipe) tuple.
export const TTL_MS = {
  suggestions: 24 * 60 * 60 * 1000, // 24h
  photo: 24 * 60 * 60 * 1000,       // 24h
  comment: 7 * 24 * 60 * 60 * 1000, // 7d
} as const;

export type CacheFeature = keyof typeof TTL_MS;

export function sha256(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

// Stable JSON hash — sorts object keys recursively so {a:1,b:2} and {b:2,a:1}
// produce the same hash. Arrays are NOT sorted (order is meaningful for some
// inputs); callers who want order-insensitive arrays should pre-sort.
export function canonicalize(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(obj).sort()) {
      out[k] = sortKeys(obj[k]);
    }
    return out;
  }
  return value;
}

export async function getCached<T>(
  feature: CacheFeature,
  inputHash: string,
): Promise<T | null> {
  const row = await prisma.recipeCache.findUnique({
    where: { feature_inputHash: { feature, inputHash } },
  });
  if (!row) return null;
  if (Date.now() - row.createdAt.getTime() > TTL_MS[feature]) return null;
  // Increment hit counter; do not block the response on this write.
  prisma.recipeCache
    .update({
      where: { id: row.id },
      data: { hitCount: { increment: 1 }, lastHitAt: new Date() },
    })
    .catch((err) => console.error("RecipeCache hit-update failed:", err));
  return row.output as T;
}

export async function setCached(
  feature: CacheFeature,
  inputHash: string,
  output: unknown,
): Promise<void> {
  await prisma.recipeCache.upsert({
    where: { feature_inputHash: { feature, inputHash } },
    create: { feature, inputHash, output: output as never },
    update: { output: output as never, lastHitAt: new Date() },
  });
}
