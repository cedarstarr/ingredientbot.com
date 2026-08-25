/**
 * Portfolio-shared AI batch client for dev-time seed generation.
 *
 * Azure (GPT-5 / GPT-5-mini) primary when configured — paid frontier, used for
 * batch jobs that need production-grade accuracy (e.g. allergen-adjacent content,
 * see scripts/lib/allergen-verify.ts). Falls back to Cerebras (Llama 3.3 70B,
 * ~2000 t/s, free 1M tok/day), then Groq (Llama 3.3 70B versatile, ~300 t/s,
 * ~14k req/day) when Azure isn't configured or a caller opts out of it.
 *
 * Designed for dev-time batch jobs (seed scripts, content generation).
 * NOT for production traffic — uses your personal API keys.
 *
 * Required env in /home/cedar/Projects/.env:
 *   CEREBRAS_API_KEY=...
 *   GROQ_API_KEY=...
 *   AZURE_OPENAI_RESOURCE=...            (optional — enables the azure provider)
 *   AZURE_OPENAI_API_KEY=...             (optional — enables the azure provider)
 *   AZURE_OPENAI_DEPLOYMENT_QUALITY=...  (optional, defaults to 'gpt-5')
 *   AZURE_OPENAI_DEPLOYMENT_BULK=...     (optional, defaults to 'gpt-5-mini')
 *
 * Required deps per consuming site (npm install -D):
 *   ai @ai-sdk/cerebras @ai-sdk/groq @ai-sdk/azure zod
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

import { appendFileSync } from 'node:fs';
import { basename } from 'node:path';
import { generateText, generateObject } from 'ai';
import { cerebras } from '@ai-sdk/cerebras';
import { groq } from '@ai-sdk/groq';
import { createAzure } from '@ai-sdk/azure';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { ZodSchema } from 'zod';

const CEREBRAS_MODEL = 'gpt-oss-120b';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const AZURE_QUALITY = process.env.AZURE_OPENAI_DEPLOYMENT_QUALITY ?? 'gpt-5';
const AZURE_BULK = process.env.AZURE_OPENAI_DEPLOYMENT_BULK ?? 'gpt-5-mini';
const azure = process.env.AZURE_OPENAI_RESOURCE && process.env.AZURE_OPENAI_API_KEY
  ? createAzure({ resourceName: process.env.AZURE_OPENAI_RESOURCE, apiKey: process.env.AZURE_OPENAI_API_KEY })
  : null;

// NVIDIA NIM — OpenAI-compatible, serves the same gpt-oss-120b, supports strict
// json_schema structured output (verified live 2026-08-23). Primary FREE lane:
// Cerebras 402s "payment required" (FOU-427) and Groq's free tier is only 200k
// tokens/DAY, which capped one seeding run at ~28 products.
//
// Resolved LAZILY on purpose. Seed scripts call dotenv config() in their own
// body and tsx hoists this import above that call, so a module-level
// process.env read is always undefined and the provider would silently never be
// offered (looks identical to "not configured"). @ai-sdk/cerebras and groq read
// their keys at call time; we must too.
//
// NOTE: the `azure` const above has this same module-load bug and is therefore
// usually inert inside tsx seeders. That is currently the only thing keeping
// seeders off the PAID lane — do NOT make it lazy without first pinning every
// seeder's providers/tier, or every batch job starts billing Azure-first.
const NVIDIA_MODEL = 'openai/gpt-oss-120b';
let nvidiaProvider: ReturnType<typeof createOpenAICompatible> | null | undefined;
function getNvidia() {
  if (nvidiaProvider === undefined) {
    nvidiaProvider = process.env.NVIDIA_API_KEY
      ? createOpenAICompatible({
          name: 'nvidia',
          baseURL: process.env.NVIDIA_BASE_URL ?? 'https://integrate.api.nvidia.com/v1',
          apiKey: process.env.NVIDIA_API_KEY,
        })
      : null;
  }
  return nvidiaProvider;
}

type Provider = 'azure' | 'nvidia' | 'cerebras' | 'groq';

export interface BatchOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  rpmLimit?: number;
  system?: string;
  temperature?: number;
  /** Azure only: 'quality' selects AZURE_QUALITY (gpt-5), 'bulk' selects AZURE_BULK (gpt-5-mini). Defaults to 'quality'. */
  tier?: 'quality' | 'bulk';
  /** Explicit provider order. Defaults to ['azure', 'cerebras', 'groq'] when azure is configured, else ['cerebras', 'groq']. */
  providers?: Provider[];
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
  azure: { ok: number; failed: number };
  nvidia: { ok: number; failed: number };
  cerebras: { ok: number; failed: number };
  groq: { ok: number; failed: number };
}
const stats: ProviderStats = {
  azure: { ok: 0, failed: 0 },
  nvidia: { ok: 0, failed: 0 },
  cerebras: { ok: 0, failed: 0 },
  groq: { ok: 0, failed: 0 },
};
export const getStats = () => structuredClone(stats);

// ─── Token accounting ────────────────────────────────────────────────────────
// Azure bills against a fixed prepaid credit, so a batch run that cannot report
// what it spent is a run you can only audit after the fact. Every successful
// call records its usage here and appends one line to a portfolio-wide ledger.
// Cerebras/Groq are free tiers priced at 0, but still recorded — a run that
// silently fell back off Azure should be visible, not invisible.
//
// Prices are USD per 1M tokens, Azure list pricing, keyed by DEPLOYMENT name
// (not base model) because that is what the caller actually selects.
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-5-4': { in: 2.5, out: 15 },
  'gpt-5-4-mini': { in: 0.75, out: 4.5 },
  'gpt-5': { in: 2.5, out: 15 },
  'gpt-5-mini': { in: 0.75, out: 4.5 },
};

const SPEND_LEDGER = process.env.AI_SPEND_LEDGER ?? '/home/cedar/Projects/.ai-spend.jsonl';
const SITE = basename(process.cwd());
const SCRIPT = basename(process.argv[1] ?? 'unknown');

interface Spend { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
const spend: Record<Provider, Spend> = {
  azure: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  nvidia: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  cerebras: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  groq: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
};
const unpricedWarned = new Set<string>();

const deploymentFor = (provider: Provider, opts: BatchOptions) =>
  provider === 'azure'
    ? (opts.tier === 'bulk' ? AZURE_BULK : AZURE_QUALITY)
    : provider === 'nvidia'
      ? NVIDIA_MODEL
      : provider === 'cerebras'
      ? CEREBRAS_MODEL
      : GROQ_MODEL;

function recordUsage(provider: Provider, opts: BatchOptions, result: unknown): void {
  const usage = (result as { usage?: Record<string, number | undefined> } | null)?.usage;
  // AI SDK v5+ reports inputTokens/outputTokens; v4 used promptTokens/completionTokens.
  const inputTokens = usage?.inputTokens ?? usage?.promptTokens ?? 0;
  const outputTokens = usage?.outputTokens ?? usage?.completionTokens ?? 0;

  const model = deploymentFor(provider, opts);
  const price = provider === 'azure' ? PRICING[model] : { in: 0, out: 0 };
  if (provider === 'azure' && !price && !unpricedWarned.has(model)) {
    unpricedWarned.add(model);
    console.warn(`[ai-batch] no price on file for Azure deployment "${model}" — its spend is counted as $0. Add it to PRICING.`);
  }
  const costUsd = ((inputTokens * (price?.in ?? 0)) + (outputTokens * (price?.out ?? 0))) / 1_000_000;

  const s = spend[provider];
  s.calls += 1;
  s.inputTokens += inputTokens;
  s.outputTokens += outputTokens;
  s.costUsd += costUsd;

  // Best-effort: accounting must never take down a seed run.
  try {
    appendFileSync(
      SPEND_LEDGER,
      JSON.stringify({
        ts: new Date().toISOString(),
        site: SITE,
        script: SCRIPT,
        provider,
        model,
        inputTokens,
        outputTokens,
        costUsd: Number(costUsd.toFixed(6)),
      }) + '\n',
      'utf8',
    );
  } catch { /* ignore */ }
}

export const getSpend = () => structuredClone(spend);

export function formatSpend(): string {
  const rows = (Object.entries(spend) as [Provider, Spend][]).filter(([, s]) => s.calls > 0);
  if (!rows.length) return '';
  const total = rows.reduce((a, [, s]) => a + s.costUsd, 0);
  const lines = rows.map(([p, s]) =>
    `  ${p.padEnd(9)} ${String(s.calls).padStart(5)} calls  ` +
    `${s.inputTokens.toLocaleString().padStart(10)} in  ` +
    `${s.outputTokens.toLocaleString().padStart(10)} out  ` +
    `$${s.costUsd.toFixed(4)}`,
  );
  return [`\nToken spend (${SITE}/${SCRIPT}):`, ...lines, `  ${'TOTAL'.padEnd(9)} $${total.toFixed(4)}`].join('\n');
}

// Printed automatically so every seeder reports spend without needing an edit.
process.on('exit', () => {
  const out = formatSpend();
  if (out) console.log(out);
});

async function withFallback<T>(
  call: (provider: Provider) => Promise<T>,
  opts: BatchOptions,
): Promise<{ result: T; provider: Provider }> {
  const freeChain: Provider[] = getNvidia() ? ['nvidia', 'cerebras', 'groq'] : ['cerebras', 'groq'];
  // AZURE IS NEVER A DEFAULT (Cedar, 2026-08-24: "don't use azure for anything.
  // We are only using it for seeding when I say so"). It is reachable ONLY by a
  // caller passing `providers: ['azure', ...]` explicitly — e.g. ingredientbot's
  // allergen lane, which is required to stay on a paid frontier model.
  //
  // Previously the default was azure-first at 'quality' tier whenever Azure creds
  // were present, which meant any caller passing `tier: 'quality'` and no
  // providers silently billed the paid deployment. That is the defect behind the
  // 17x cost overrun, and it was only masked by the fact that the `azure` const
  // below is evaluated at module load — before tsx-hoisted seeders run dotenv —
  // so it read as unconfigured. Do not rely on that accident; this is the fix.
  const providers: Provider[] = opts.providers ?? freeChain;
  if (providers.includes('azure') && !azure) {
    throw new Error('[ai-batch] azure requested but AZURE_OPENAI_RESOURCE / AZURE_OPENAI_API_KEY not set');
  }
  if (providers.includes('nvidia') && !getNvidia()) {
    throw new Error('[ai-batch] nvidia requested but NVIDIA_API_KEY not set');
  }
  const maxRetries = opts.maxRetries ?? 3;
  const initialBackoff = opts.initialBackoffMs ?? 1000;
  let lastError: unknown;

  if (providers.includes('azure')) {
    console.warn('[ai-batch] ⚠ azure lane engaged (PAID) — explicit opt-in by this caller, not a default.');
  }
  for (const provider of providers) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        await limiter.wait();
        const result = await call(provider);
        stats[provider].ok += 1;
        recordUsage(provider, opts, result);
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

const modelFor = (provider: Provider, opts: BatchOptions) =>
  provider === 'azure'
    ? azure!(opts.tier === 'bulk' ? AZURE_BULK : AZURE_QUALITY)
    : provider === 'nvidia'
      ? getNvidia()!(NVIDIA_MODEL)
      : provider === 'cerebras'
      ? cerebras(CEREBRAS_MODEL)
      : groq(GROQ_MODEL);

export async function batchText(prompt: string, opts: BatchOptions = {}): Promise<string> {
  const { result } = await withFallback(
    (provider) =>
      generateText({
        model: modelFor(provider, opts),
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
        model: modelFor(provider, opts),
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
