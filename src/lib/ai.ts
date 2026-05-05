import { anthropic } from '@ai-sdk/anthropic'
import { google } from '@ai-sdk/google'

export const claudeSonnet = anthropic('claude-sonnet-4-6')
export const claudeHaiku = anthropic('claude-haiku-4-5-20251001')

export const geminiFlashLite = google('gemini-2.5-flash-lite')
export const geminiFlash = google('gemini-2.5-flash')

// When switching any call to `geminiFlash`, also pass:
//   providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } }
// Flash has thinking mode ON by default — without this, hidden reasoning
// tokens can 2-6× the output cost. Flash-lite has no thinking mode, so
// the option is a no-op there.
