/**
 * Portfolio-shared AI batch client for dev-time seed generation.
 *
 * Cerebras primary (Llama 3.3 70B, ~2000 t/s, free 1M tok/day),
 * Groq fallback (Llama 3.3 70B versatile, ~300 t/s, ~14k req/day).
 *
 * Designed for dev-time batch jobs (seed scripts, content generation).
 * NOT for production traffic — uses your personal API keys.
 *
 * Required env in /home/cedar/Projects/.env:
 *   CEREBRAS_API_KEY=...
 *   GROQ_API_KEY=...
 *
 * Required deps per consuming site (npm install -D):
 *   ai @ai-sdk/cerebras @ai-sdk/groq zod
 *
 * Usage from a site's scripts/seed-*.ts:
 *   import { batchText, batchObject, batchMap } from '../../ai-batch';
 *
 *   const recipes = await batchMap(
 *     ['chicken curry', 'mushroom risotto', 'thai basil pork'],
 *     async (dish, { object }) => object(
 *       `Generate a recipe for ${dish}`,
 *       z.object({ title: z.string(), ingredients: z.array(z.string()), steps: z.array(z.string()) })
 *     ),
 *     { onProgress: (d, t) => console.log(`${d}/${t}`) }
 *   );
 */

import { generateText, generateObject } from 'ai';
import { cerebras } from '@ai-sdk/cerebras';
import { groq } from '@ai-sdk/groq';
import type { ZodSchema } from 'zod';

const CEREBRAS_MODEL = 'gpt-oss-120b';
const GROQ_MODEL = 'openai/gpt-oss-120b';

type Provider = 'cerebras' | 'groq';

export interface BatchOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  rpmLimit?: number;
  system?: string;
  temperature?: number;
}

class RateLimiter {
  private timestamps: number[] = [];
  constructor(private rpm: number) {}

  async wait(): Promise<void> {
    const now = Date.now();
    const windowStart = now - 60_000;
    this.timestamps = this.timestamps.filter(t => t > windowStart);
    if (this.timestamps.length >= this.rpm) {
      const waitMs = 60_000 - (now - this.timestamps[0]) + 100;
      await sleep(waitMs);
      return this.wait();
    }
    this.timestamps.push(Date.now());
  }
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

const limiter = new RateLimiter(25);

interface ProviderStats {
  cerebras: { ok: number; failed: number };
  groq: { ok: number; failed: number };
}
const stats: ProviderStats = {
  cerebras: { ok: 0, failed: 0 },
  groq: { ok: 0, failed: 0 },
};
export const getStats = () => structuredClone(stats);

async function withFallback<T>(
  call: (provider: Provider) => Promise<T>,
  opts: BatchOptions,
): Promise<{ result: T; provider: Provider }> {
  const providers: Provider[] = ['cerebras', 'groq'];
  const maxRetries = opts.maxRetries ?? 3;
  const initialBackoff = opts.initialBackoffMs ?? 1000;
  let lastError: unknown;

  for (const provider of providers) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await limiter.wait();
        const result = await call(provider);
        stats[provider].ok += 1;
        return { result, provider };
      } catch (err) {
        lastError = err;
        const status = extractStatus(err);
        const isRateLimit = status === 429;
        const isServerError = status >= 500 && status < 600;
        const isRetryable = isRateLimit || isServerError;

        if (!isRetryable) {
          stats[provider].failed += 1;
          console.warn(`[ai-batch] ${provider} hard failure (${status}): ${describe(err)}`);
          break;
        }

        const backoff = initialBackoff * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[ai-batch] ${provider} ${status} (attempt ${attempt + 1}/${maxRetries}) — backing off ${Math.round(backoff)}ms`,
        );
        await sleep(backoff);
        if (attempt === maxRetries - 1) stats[provider].failed += 1;
      }
    }
  }

  throw new Error(`[ai-batch] all providers exhausted: ${describe(lastError)}`);
}

function extractStatus(err: unknown): number {
  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const s = (e.status ?? e.statusCode ?? (e.response as Record<string, unknown>)?.status) as number | undefined;
    if (typeof s === 'number') return s;
  }
  return 0;
}

function describe(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function batchText(prompt: string, opts: BatchOptions = {}): Promise<string> {
  const { result } = await withFallback(
    (provider) =>
      generateText({
        model: provider === 'cerebras' ? cerebras(CEREBRAS_MODEL) : groq(GROQ_MODEL),
        prompt,
        system: opts.system,
        temperature: opts.temperature,
      }),
    opts,
  );
  return result.text;
}

export async function batchObject<T>(
  prompt: string,
  schema: ZodSchema<T>,
  opts: BatchOptions = {},
): Promise<T> {
  const { result } = await withFallback(
    (provider) =>
      generateObject({
        model: provider === 'cerebras' ? cerebras(CEREBRAS_MODEL) : groq(GROQ_MODEL),
        schema,
        prompt,
        system: opts.system,
        temperature: opts.temperature,
      }),
    opts,
  );
  return result.object;
}

export interface BatchMapHelpers {
  text: typeof batchText;
  object: typeof batchObject;
}

export interface BatchMapOptions<I> {
  onProgress?: (done: number, total: number, lastItem: I) => void;
  onError?: (err: unknown, item: I, index: number) => 'skip' | 'throw';
}

export async function batchMap<I, O>(
  items: I[],
  fn: (item: I, helpers: BatchMapHelpers) => Promise<O>,
  opts: BatchMapOptions<I> = {},
): Promise<O[]> {
  const out: O[] = [];
  const helpers: BatchMapHelpers = { text: batchText, object: batchObject };
  for (let i = 0; i < items.length; i++) {
    try {
      const result = await fn(items[i], helpers);
      out.push(result);
      opts.onProgress?.(i + 1, items.length, items[i]);
    } catch (err) {
      const decision = opts.onError?.(err, items[i], i) ?? 'throw';
      if (decision === 'throw') throw err;
      console.warn(`[ai-batch] skipping item ${i} after error: ${describe(err)}`);
    }
  }
  return out;
}
