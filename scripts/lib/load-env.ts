/**
 * Side-effect env loader for seed/utility scripts. MUST be the FIRST import in
 * every script entrypoint that reads env at module scope.
 *
 * Why: import hoisting evaluates every imported module before any statement in
 * the importing file runs — an inline `config()` call placed between imports
 * executes AFTER modules like ./_prisma (which captures DATABASE_URL into its
 * pg adapter at module scope) and ./lib/ai-batch (which gates the Azure lane on
 * AZURE_OPENAI_* at module scope) have already evaluated. Under tsx this made
 * the old preamble silently load nothing: pg dialed localhost instead of the
 * synced staging URL. A first-position side-effect import is evaluated before
 * any later import's module body, so env is populated in time.
 *
 * Load order: portfolio .env first, then repo .env (dotenv never overrides
 * already-set keys, so the earlier file wins on conflicts — same precedence as
 * the old preamble).
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'

config({ path: resolve(__dirname, '../../../.env') }) // /home/cedar/Projects/.env
config({ path: resolve(__dirname, '../../.env') }) // repo .env
