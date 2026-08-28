/**
 * Portfolio-shared AI batch client for dev-time seed generation.
 *
 * Free lanes by default: NVIDIA NIM then Groq (both serving gpt-oss-120b).
 * Paid lanes are explicit opt-in only, per the decisions of record:
 *   'ds'    — DeepSeek V4 Flash on Azure AI Foundry: the seeding workhorse
 *             (Notion "AI Model Routing & Seeding Plan", 2026-08-23/24).
 *   'azure' — Azure OpenAI gpt-5-4 / gpt-5-4-mini: spot-check passes and the
 *             lanes with a hard paid-frontier rule (ingredientbot allergens).
 *
 * Designed for dev-time batch jobs (seed scripts, content generation).
 * NOT for production traffic — uses your personal API keys.
 *
 * Required env in /home/cedar/Projects/.env:
 *   AZURE_OPENAI_RESOURCE=...             (optional — enables the azure lane)
 *   AZURE_OPENAI_API_KEY=...              (optional — enables the azure lane)
 *   AZURE_OPENAI_DEPLOYMENT_QUALITY=...   (optional — defaults to 'gpt-5')
 *   AZURE_OPENAI_DEPLOYMENT_BULK=...      (optional — defaults to 'gpt-5-mini')
 *   AZURE_FOUNDRY_RESOURCE=...            (optional — enables the ds lane)
 *   AZURE_FOUNDRY_API_KEY=...             (optional — enables the ds lane)
 *   AZURE_FOUNDRY_DEPLOYMENT_DS=...       (optional — defaults to 'deepseek-v4-flash')
 *   NVIDIA_API_KEY=...
 *   GROQ_API_KEY=...
 *
 * Required deps per consuming site (npm install -D):
 *   ai @ai-sdk/azure @ai-sdk/openai-compatible @ai-sdk/cerebras @ai-sdk/groq zod
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
import { createAzure } from '@ai-sdk/azure';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { cerebras } from '@ai-sdk/cerebras';
import { groq } from '@ai-sdk/groq';
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

// DeepSeek V4 Flash on the Azure AI Foundry resource (AZURE_FOUNDRY_*, a
// DIFFERENT resource + key from AZURE_OPENAI_*). The seeding lane of record
// since 2026-08-23/24 — 11x cheaper than gpt-5-4 on a 70/30 blend; gpt-5-4 is
// reserved for spot-check passes. Lazy for the same tsx-hoisting reason as
// nvidia above; lazy is SAFE here because 'ds' is never in a default chain —
// it is reachable only via an explicit providers: ['ds'].
// The api-key header is what the endpoint was verified with (2026-08-27);
// createOpenAICompatible's apiKey option only sets Authorization: Bearer.
let dsProvider: ReturnType<typeof createOpenAICompatible> | null | undefined;
function getDs() {
  if (dsProvider === undefined) {
    const resource = process.env.AZURE_FOUNDRY_RESOURCE;
    const apiKey = process.env.AZURE_FOUNDRY_API_KEY;
    dsProvider = resource && apiKey
      ? createOpenAICompatible({
          name: 'azure-foundry',
          baseURL: `https://${resource}.services.ai.azure.com/openai/v1`,
          apiKey,
          headers: { 'api-key': apiKey },
          supportsStructuredOutputs: true,
        })
      : null;
  }
  return dsProvider;
}
const dsDeployment = () => process.env.AZURE_FOUNDRY_DEPLOYMENT_DS ?? 'deepseek-v4-flash';

type Provider = 'azure' | 'ds' | 'nvidia' | 'cerebras' | 'groq';

export interface BatchOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  rpmLimit?: number;
  system?: string;
  temperature?: number;
  /** Azure only: 'quality' selects AZURE_QUALITY (gpt-5-4), 'bulk' selects AZURE_BULK (gpt-5-4-mini). Ignored by every other provider. */
  tier?: 'quality' | 'bulk';
  /** Explicit provider order. Defaults to the FREE chain (nvidia → groq). Paid lanes ('ds', 'azure') run only when named here. */
  providers?: Provider[];
  /**
   * Per-request deadline. Without one a hung socket waits forever: on 2026-08-28 an
   * ingredient seed run sat on an open TLS connection to Azure for 13 minutes with empty
   * send and receive queues, and would have stayed there all night. 120s is far above the
   * ~35s a long prose call takes, so it fires only on a genuinely dead request.
   */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 120_000;

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

// 18 rpm, not 25: the ds deployment's Azure quota is 20 RPM (GlobalStandard,
// capacity 20, the subscription maximum for this model) — leave headroom.
const limiter = new RateLimiter(18);

interface ProviderStats {
  azure: { ok: number; failed: number };
  ds: { ok: number; failed: number };
  nvidia: { ok: number; failed: number };
  cerebras: { ok: number; failed: number };
  groq: { ok: number; failed: number };
}
const stats: ProviderStats = {
  azure: { ok: 0, failed: 0 },
  ds: { ok: 0, failed: 0 },
  nvidia: { ok: 0, failed: 0 },
  cerebras: { ok: 0, failed: 0 },
  groq: { ok: 0, failed: 0 },
};
export const getStats = () => structuredClone(stats);

// ─── Token accounting ────────────────────────────────────────────────────────
// Azure bills against a fixed prepaid credit, so a batch run that cannot report
// what it spent is a run you can only audit after the fact. Every successful
// call records its usage here and appends one line to a portfolio-wide ledger.
// Free lanes are priced at 0, but still recorded — a run that silently fell
// back off a paid lane should be visible, not invisible.
//
// Prices are USD per 1M tokens, Azure list pricing, keyed by DEPLOYMENT name
// (not base model) because that is what the caller actually selects.
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-5-4': { in: 2.5, out: 15 },
  'gpt-5-4-mini': { in: 0.75, out: 4.5 },
  'gpt-5': { in: 2.5, out: 15 },
  'gpt-5-mini': { in: 0.75, out: 4.5 },
  // DeepSeek-V4-Flash 2026-04-23, GlobalStandard westus3 — retail-price API,
  // verified 2026-08-27. Cached input is cheaper ($0.028/M) and not modeled, so
  // ledger cost is a slight overestimate on cache-friendly prompts.
  'deepseek-v4-flash': { in: 0.19, out: 0.51 },
};

const SPEND_LEDGER = process.env.AI_SPEND_LEDGER ?? '/home/cedar/Projects/.ai-spend.jsonl';
const SITE = basename(process.cwd());
const SCRIPT = basename(process.argv[1] ?? 'unknown');

interface Spend { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
const spend: Record<Provider, Spend> = {
  azure: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  ds: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  nvidia: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  cerebras: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  groq: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
};
const unpricedWarned = new Set<string>();

const PAID_PROVIDERS: readonly Provider[] = ['azure', 'ds'];

const deploymentFor = (provider: Provider, opts: BatchOptions) =>
  provider === 'azure'
    ? (opts.tier === 'bulk' ? AZURE_BULK : AZURE_QUALITY)
    : provider === 'ds'
      ? dsDeployment()
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
  const isPaid = PAID_PROVIDERS.includes(provider);
  const price = isPaid ? PRICING[model] : { in: 0, out: 0 };
  if (isPaid && !price && !unpricedWarned.has(model)) {
    unpricedWarned.add(model);
    console.warn(`[ai-batch] no price on file for paid deployment "${model}" — its spend is counted as $0. Add it to PRICING.`);
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
  // CEREBRAS REMOVED 2026-08-24 (Cedar: "we dont use cerebras anymore"). It ended
  // its automatic free tier 2026-08-17 and now 402s "payment required" on every
  // call — a 402 is not retryable, so leaving it in the chain cost one wasted
  // round-trip per item and nothing else. `cerebras` remains a valid Provider
  // value for an explicit `providers: ['cerebras']` opt-in, but is never default.
  const freeChain: Provider[] = getNvidia() ? ['nvidia', 'groq'] : ['groq'];
  // PAID LANES ARE NEVER A DEFAULT (Cedar, 2026-08-24: "don't use azure for
  // anything. We are only using it for seeding when I say so"). 'azure' and 'ds'
  // are reachable ONLY by a caller passing providers: ['azure', ...] or
  // providers: ['ds', ...] explicitly — e.g. ingredientbot's allergen lane,
  // which is required to stay on a paid frontier model, or an approved seeding
  // batch on the ds lane.
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
  if (providers.includes('ds') && !getDs()) {
    throw new Error('[ai-batch] ds requested but AZURE_FOUNDRY_RESOURCE / AZURE_FOUNDRY_API_KEY not set');
  }
  if (providers.includes('nvidia') && !getNvidia()) {
    throw new Error('[ai-batch] nvidia requested but NVIDIA_API_KEY not set');
  }
  const maxRetries = opts.maxRetries ?? 3;
  const initialBackoff = opts.initialBackoffMs ?? 1000;
  let lastError: unknown;

  const paid = providers.filter(p => PAID_PROVIDERS.includes(p));
  if (paid.length) {
    console.warn(`[ai-batch] ⚠ paid lane engaged (${paid.join(', ')}) — explicit opt-in by this caller, not a default.`);
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
        // A timeout is the one client-side failure worth retrying: the request never
        // reached a verdict, so the next attempt is not a repeat of a rejected call.
        const isTimeout =
          err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
        const isRetryable = isRateLimit || isServerError || isTimeout;

        if (!isRetryable) {
          stats[provider].failed += 1;
          console.warn(`[ai-batch] ${provider} hard failure (${status}): ${describe(err)}`);
          break;
        }

        const backoff = initialBackoff * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[ai-batch] ${provider} ${isTimeout ? 'timed out' : status} (attempt ${attempt + 1}/${maxRetries}) — backing off ${Math.round(backoff)}ms`,
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
  provider === 'azure' ? azure!(opts.tier === 'bulk' ? AZURE_BULK : AZURE_QUALITY)
  : provider === 'ds' ? getDs()!(dsDeployment())
  : provider === 'nvidia' ? getNvidia()!(NVIDIA_MODEL)
  : provider === 'cerebras' ? cerebras(CEREBRAS_MODEL)
  : groq(GROQ_MODEL);

export async function batchText(prompt: string, opts: BatchOptions = {}): Promise<string> {
  const { result } = await withFallback(
    (provider) =>
      generateText({
        model: modelFor(provider, opts),
        prompt,
        system: opts.system,
        temperature: opts.temperature,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
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
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS),
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
