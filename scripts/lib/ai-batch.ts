/**
 * Portfolio-shared AI batch client for dev-time seed generation.
 *
 * Free lane by default: Groq (gpt-oss-120b). NVIDIA NIM was the first hop until
 * 2026-09-03, when NIM retired `openai/gpt-oss-120b` (410 Gone) — it is still a
 * valid explicit opt-in, but leaving it in the default chain only bought a
 * guaranteed-failing round-trip per item, so it is gone from the default.
 *
 * Paid lanes are explicit opt-in only:
 *   'broker' — the shared AI broker's `seeding` lane: DeepSeek V4 Flash and
 *              nothing else. THE seeding workhorse.
 *   'ds'     — alias for 'broker', kept because eleven call sites pin it and they
 *              still mean what they said: DeepSeek, one model, no fallback.
 *
 * THERE IS NO AZURE IN THIS FILE, BY DECISION (Cedar, 2026-09-05: "I don't want
 * anything pointed to azure at all"). The Azure OpenAI ('azure', gpt-5-4) and
 * Azure AI Foundry ('azure-foundry', the old ds deployment) providers are gone,
 * not disabled. A caller that still names either gets an error saying so rather
 * than a silent reroute — the seeders that did (ingredientbot allergens, gurumind
 * public concepts) need a new paid-frontier decision, not a quiet substitute.
 * The AZURE_* keys stay in .env per the never-delete-unused-keys rule.
 *
 * NO GEMINI EITHER, AS FALLBACK OR OTHERWISE, IN A SEEDING RUN. The broker's
 * `structured-extraction` lane reroutes to gemini-flash-lite the moment DeepSeek's
 * 20 rpm saturates; this file never names that lane, and `batchObject()` cannot
 * be pointed at it.
 *
 * SCHEMA-BEARING CALLS GO THROUGH THE BROKER, ALWAYS AND ONLY (FOU-508).
 * `batchObject()` pins itself to the `seeding` lane and REFUSES a provider chain.
 * Two independent reasons, both learned the hard way:
 *   - Correctness. `supportsStructuredOutputs` was set on exactly one provider in
 *     this file (Azure Foundry). Everywhere else the AI SDK silently degraded to
 *     `json_object`, the JSON schema never reached the model, and the response
 *     only failed Zod on arrival — which reads as a flaky model, not a
 *     misconfigured provider (FOU-424).
 *   - Provenance. A seeding run uses one model or it stops (CLAUDE.md → "Seeding
 *     runs: DeepSeek only, no fallback"). A chain mixes models inside one
 *     permanent table with nothing in the row recording which, so the quality
 *     difference reads as data noise forever. A halted run leaves a clean,
 *     resumable gap instead.
 *
 * Designed for dev-time batch jobs (seed scripts, content generation).
 * NOT for production traffic — uses your personal API keys.
 *
 * Required env (the site .env carries the broker pair; /home/cedar/Projects/.env the rest):
 *   AI_BROKER_URL=...                     (required — enables 'broker' / 'ds')
 *   AI_BROKER_KEY=...                     (required — this site's broker key)
 *   NVIDIA_API_KEY=...                    (optional — explicit 'nvidia' opt-in only)
 *   GROQ_API_KEY=...
 *
 * Required deps per consuming site (npm install -D):
 *   ai @ai-sdk/openai-compatible @ai-sdk/cerebras @ai-sdk/groq zod
 *   (@ai-sdk/azure is no longer imported here; it may still sit in package.json)
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
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { cerebras } from '@ai-sdk/cerebras';
import { groq } from '@ai-sdk/groq';
import type { ZodSchema } from 'zod';

const CEREBRAS_MODEL = 'gpt-oss-120b';
const GROQ_MODEL = 'openai/gpt-oss-120b';

// The shared AI broker's DeepSeek-only seeding lane. `seeding`'s chain is ONE
// model by design — see the header. Do not point this at `structured-extraction`
// (chain: deepseek → openrouter-structured → gemini-flash-lite): that lane exists
// for live request-time extraction, where finishing on a different model is
// better than failing, and a seeding run wants the opposite trade.
export const BROKER_SEEDING_LANE = 'seeding';
// Lazy for the same tsx-hoisting reason as every other provider here: a seeder
// calls dotenv in its own body, after this module has already been evaluated.
let brokerProviderInstance: ReturnType<typeof createOpenAICompatible> | null | undefined;
function getBroker() {
  if (brokerProviderInstance === undefined) {
    const url = process.env.AI_BROKER_URL;
    const apiKey = process.env.AI_BROKER_KEY;
    brokerProviderInstance = url && apiKey
      ? createOpenAICompatible({
          name: 'ai-broker',
          baseURL: url,
          apiKey,
          // LOAD-BEARING (FOU-424). Without it the SDK downgrades to
          // `json_object`, the schema never reaches the model, and Zod fails on
          // arrival looking like model flakiness.
          supportsStructuredOutputs: true,
          headers: {
            'x-feature': basename(process.argv[1] ?? 'ai-batch'),
            // Seeders are batch by definition: the broker's 240s queue deadline,
            // never the 15s interactive fail-fast.
            'x-priority': 'batch',
          },
        })
      : null;
  }
  return brokerProviderInstance;
}

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

// 'ds' is an ALIAS for 'broker' (FOU-508) — the DeepSeek seeding lane. It is
// kept because eleven call sites across the portfolio pin it and they still
// mean what they said: DeepSeek, one model, no fallback.
type Provider = 'broker' | 'ds' | 'nvidia' | 'cerebras' | 'groq';
/** Named by old pins; refused at runtime with a message, since tsx does not typecheck. */
const REMOVED_PROVIDERS = new Set(['azure', 'azure-foundry']);

/** Resolve the deprecated alias. Everything downstream sees only 'broker'. */
const dsAliasWarned = { done: false };
function canonicalProvider(p: Provider): Provider {
  if (p !== 'ds') return p;
  if (!dsAliasWarned.done) {
    dsAliasWarned.done = true;
    console.warn(
      "[ai-batch] provider 'ds' is an alias for 'broker' (the broker's DeepSeek-only " +
      "`seeding` lane) since FOU-508. Same model, live host. Prefer 'broker' in new code.",
    );
  }
  return 'broker';
}

export interface BatchOptions {
  maxRetries?: number;
  initialBackoffMs?: number;
  rpmLimit?: number;
  system?: string;
  temperature?: number;
  /**
   * @deprecated Selected an Azure OpenAI deployment; Azure is gone (2026-09-05).
   * Accepted and ignored so the call sites that still pass it keep running.
   */
  tier?: 'quality' | 'bulk';
  /**
   * Explicit provider order. Defaults to the FREE chain (groq). The paid lane
   * ('broker', alias 'ds') runs only when named here.
   *
   * `batchObject()` ignores any chain longer than the broker: schema-bearing
   * calls are pinned to the DeepSeek-only `seeding` lane and throw rather than
   * fall through. See the header.
   */
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

// 18 rpm: the broker's deepseek-streamlake model allows 20 and other sites share
// it — leave headroom rather than queue on the broker for the last two.
const limiter = new RateLimiter(18);

// Keyed by CANONICAL provider — 'ds' resolves to 'broker' before it gets here,
// so a run that pins 'ds' reports under 'broker' and the two can never be
// double-counted as separate lanes.
type ProviderStats = Record<Exclude<Provider, 'ds'>, { ok: number; failed: number }>;
const stats: ProviderStats = {
  broker: { ok: 0, failed: 0 },
  nvidia: { ok: 0, failed: 0 },
  cerebras: { ok: 0, failed: 0 },
  groq: { ok: 0, failed: 0 },
};
export const getStats = () => structuredClone(stats);

// ─── Token accounting ────────────────────────────────────────────────────────
// The broker lane is metered, so a batch run that cannot report what it spent
// is a run you can only audit after the fact. Every successful
// call records its usage here and appends one line to a portfolio-wide ledger.
// Free lanes are priced at 0, but still recorded — a run that silently fell
// back off a paid lane should be visible, not invisible.
//
// Prices are USD per 1M tokens, keyed by what the caller actually selects.
const PRICING: Record<string, { in: number; out: number }> = {
  // The broker's `seeding` lane — DeepSeek V4 Flash on StreamLake via OpenRouter,
  // priced from the broker's own model catalog (priceVerified). Keyed by LANE id
  // because the lane is what this client selects; the broker's ledger (GET /stats)
  // stays authoritative for actual spend.
  seeding: { in: 0.056, out: 0.112 },
};

const SPEND_LEDGER = process.env.AI_SPEND_LEDGER ?? '/home/cedar/Projects/.ai-spend.jsonl';
const SITE = basename(process.cwd());
const SCRIPT = basename(process.argv[1] ?? 'unknown');

interface Spend { calls: number; inputTokens: number; outputTokens: number; costUsd: number }
const spend: Record<Exclude<Provider, 'ds'>, Spend> = {
  broker: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  nvidia: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  cerebras: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
  groq: { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 },
};
const unpricedWarned = new Set<string>();

const PAID_PROVIDERS: readonly Provider[] = ['broker', 'ds'];

const deploymentFor = (provider: Provider, _opts: BatchOptions) =>
  provider === 'broker'
    ? BROKER_SEEDING_LANE
    : provider === 'nvidia'
      ? NVIDIA_MODEL
      : provider === 'cerebras'
        ? CEREBRAS_MODEL
        : GROQ_MODEL;

function recordUsage(provider: Exclude<Provider, 'ds'>, opts: BatchOptions, result: unknown): void {
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
  const rows = (Object.entries(spend) as [Exclude<Provider, 'ds'>, Spend][]).filter(([, s]) => s.calls > 0);
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
  // NVIDIA left the default chain 2026-09-03: NIM retired `openai/gpt-oss-120b`
  // with 410 Gone, so it was a guaranteed-failing first hop on every item — the
  // same shape as the Cerebras 402 removed above. Still reachable as an explicit
  // providers: ['nvidia'] for the day NIM carries the model again.
  const freeChain: Provider[] = ['groq'];
  // THE PAID LANE IS NEVER A DEFAULT (Cedar, 2026-08-24). 'broker'/'ds' is
  // reachable ONLY by a caller passing providers: ['ds'] explicitly — an approved
  // seeding batch. (The old default was Azure-first whenever Azure creds were
  // present, which billed the paid deployment for any caller that passed a tier
  // and no providers; that was the defect behind the 17x cost overrun.)
  const named = (opts.providers ?? []) as string[];
  const gone = named.filter((p) => REMOVED_PROVIDERS.has(p));
  if (gone.length) {
    throw new Error(
      `[ai-batch] provider(s) ${gone.join(', ')} no longer exist — Azure was removed from every site ` +
      `on 2026-09-05 (Cedar: "I don't want anything pointed to azure at all"). This caller needs a new ` +
      `decision: if it must stay on a paid frontier model (allergens), ask Cedar which; otherwise pin ` +
      `providers: ['ds'] for the broker's DeepSeek-only seeding lane.`,
    );
  }
  const providers: Provider[] = (opts.providers ?? freeChain).map(canonicalProvider);
  if (providers.includes('broker') && !getBroker()) {
    throw new Error('[ai-batch] broker requested but AI_BROKER_URL / AI_BROKER_KEY not set — scripts load them via `import "./_env"`');
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
        stats[provider as Exclude<Provider, 'ds'>].ok += 1;
        recordUsage(provider as Exclude<Provider, 'ds'>, opts, result);
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
          stats[provider as Exclude<Provider, 'ds'>].failed += 1;
          console.warn(`[ai-batch] ${provider} hard failure (${status}): ${describe(err)}`);
          break;
        }

        const backoff = initialBackoff * Math.pow(2, attempt) + Math.random() * 500;
        console.warn(
          `[ai-batch] ${provider} ${isTimeout ? 'timed out' : status} (attempt ${attempt + 1}/${maxRetries}) — backing off ${Math.round(backoff)}ms`,
        );
        await sleep(backoff);
        if (attempt === maxRetries - 1) stats[provider as Exclude<Provider, 'ds'>].failed += 1;
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

const modelFor = (provider: Provider, _opts: BatchOptions) =>
  provider === 'broker' ? getBroker()!.chatModel(BROKER_SEEDING_LANE)
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

/**
 * One schema-bearing call, PINNED to the broker's DeepSeek-only `seeding` lane.
 *
 * The pin is the fix for FOU-508 and it is deliberately not overridable. Two
 * things go wrong when a schema call is allowed to pick its own provider:
 * `supportsStructuredOutputs` is set on the broker and nowhere else, so any other
 * hop silently degrades to `json_object` and the schema never reaches the model
 * (FOU-424); and a chain mixes models inside one permanent table with nothing in
 * the row recording which, which is the provenance failure the DeepSeek-only rule
 * exists to prevent. A caller naming a different provider is told so rather than
 * quietly rerouted — the whole class of bug here is silent substitution.
 *
 * `providers: ['ds']` and `providers: ['broker']` both resolve here and are fine.
 */
export async function batchObject<T>(
  prompt: string,
  schema: ZodSchema<T>,
  opts: BatchOptions = {},
): Promise<T> {
  const named = (opts.providers ?? []).map(canonicalProvider);
  const offLane = named.filter((p) => p !== 'broker');
  if (offLane.length) {
    throw new Error(
      `[ai-batch] batchObject is pinned to the broker '${BROKER_SEEDING_LANE}' lane and cannot use ` +
      `${offLane.join(', ')} (FOU-508). A seeding run uses one model or it stops — using any model ` +
      `other than DeepSeek needs Cedar's permission, asked BEFORE the run. Drop the providers option, ` +
      `or use batchText if this call carries no schema.`,
    );
  }
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
    { ...opts, providers: ['broker'] },
  );
  return result.object;
}

export interface BatchMapHelpers {
  text: typeof batchText;
  object: typeof batchObject;
}

export interface BatchMapOptions<I> {
  /**
   * Parallel workers. Default 1 = serial, so every existing caller is unchanged.
   *
   * Serial is a holdover from the free lanes, where Groq's 8k tokens-per-minute bound
   * throughput long before request count did — at ~1k tokens a call that is ~8 calls/min,
   * so a worker pool bought nothing. The paid ds lane has no tpm squeeze and a 20 rpm cap,
   * where serial 35s calls use about 8% of it.
   *
   * The shared 18-rpm limiter below still caps total throughput across every provider, so
   * raising this cannot breach quota — it only stops the process idling between calls.
   */
  concurrency?: number;
  /**
   * Preserve index alignment with `items` instead of compacting away skips.
   *
   * Default false keeps every existing caller byte-identical in behaviour. With
   * `keepHoles: true` a skipped item yields `null` at its original index, so
   * `results[i]` always corresponds to `items[i]`. Prefer the tuple pattern in the
   * mapper (see batchMap's doc comment) — this option exists for callers that
   * genuinely need a positional array, e.g. writing back into a fixed-width table.
   */
  keepHoles?: boolean;
  onProgress?: (done: number, total: number, lastItem: I) => void;
  onError?: (err: unknown, item: I, index: number) => 'skip' | 'throw';
}

/**
 * Map `items` through `fn`, one AI call per item, under the shared rate limiter.
 *
 * ⚠️ OUTPUT IS COMPACTED AFTER SKIPS — **never zip results against inputs by index.**
 * When `onError` returns 'skip' the failed item is REMOVED from the output array, not
 * left as a hole, so `results[i]` stops corresponding to `items[i]` from the first skip
 * onwards. Nothing throws and the counts look plausible; the pairing is just wrong.
 * On 2026-08-29 this shipped 12 padhr ComplianceDeadline rows each carrying the NEXT
 * item's description (FOU-443) — caught only by a human reading every row.
 *
 * Return the pairing from the mapper so it travels with the result and compaction
 * cannot shear it:
 *
 * ```ts
 * const pairs = await batchMap(seeds, async (seed, ai) => {
 *   const generated = await ai.object({ ... });
 *   return { seed, generated };            // ✅ association survives a skip
 * }, { onError: () => 'skip' });
 * for (const { seed, generated } of pairs) { ... }
 * ```
 *
 * Pass `keepHoles: true` if you genuinely need a positionally-aligned array; skipped
 * items then come back as `null` at their original index.
 */
export async function batchMap<I, O>(
  items: I[],
  fn: (item: I, helpers: BatchMapHelpers) => Promise<O>,
  opts: BatchMapOptions<I> & { keepHoles: true },
): Promise<(O | null)[]>;
export async function batchMap<I, O>(
  items: I[],
  fn: (item: I, helpers: BatchMapHelpers) => Promise<O>,
  opts?: BatchMapOptions<I>,
): Promise<O[]>;
export async function batchMap<I, O>(
  items: I[],
  fn: (item: I, helpers: BatchMapHelpers) => Promise<O>,
  opts: BatchMapOptions<I> = {},
): Promise<(O | null)[]> {
  const helpers: BatchMapHelpers = { text: batchText, object: batchObject };
  // AI_BATCH_CONCURRENCY lets a run be parallelised without touching the seeder, which
  // matters because every caller here is a one-off script invoked by hand. An explicit
  // opts.concurrency still wins. Number(undefined) is NaN and NaN || 1 is 1, so an unset
  // or unparseable variable falls back to serial.
  const envConcurrency = Number(process.env.AI_BATCH_CONCURRENCY) || 1;
  const concurrency = Math.max(1, Math.floor(opts.concurrency ?? envConcurrency));
  // Results are written by index, so output ORDER follows input order regardless of which
  // worker finishes first. Order is not alignment: unless keepHoles is set, the array is
  // compacted at the end and skipped items vanish, shifting every later result up. See the
  // doc comment above — return tuples from the mapper rather than zipping by index.
  const SKIP = Symbol('skip');
  const results: (O | typeof SKIP)[] = new Array(items.length).fill(SKIP);
  let next = 0;
  let done = 0;
  const worker = async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      try {
        results[i] = await fn(items[i], helpers);
      } catch (err) {
        const decision = opts.onError?.(err, items[i], i) ?? 'throw';
        // 'throw' rejects the whole batch; sibling workers' in-flight calls are abandoned, not cancelled.
        if (decision === 'throw') throw err;
        console.warn(`[ai-batch] skipping item ${i} after error: ${describe(err)}`);
      }
      done += 1;
      opts.onProgress?.(done, items.length, items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) || 1 }, worker));
  if (opts.keepHoles) return results.map((r) => (r === SKIP ? null : (r as O)));
  return results.filter((r): r is O => r !== SKIP);
}
