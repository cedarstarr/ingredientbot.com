import { checkBotId } from 'botid/server'
import { NextResponse } from 'next/server'

/**
 * Returns a 403 for a request BotID classifies as a bot, or null to continue.
 * The route must also be listed in BOTID_PROTECTED_ROUTES.
 */
export async function rejectBots(): Promise<NextResponse | null> {
  // chose skipping off-Vercel over always calling checkBotId because botid only
  // bypasses when NODE_ENV !== 'production' — a local `next start` (Playwright's
  // webServer) would throw on the missing VERCEL_OIDC_TOKEN and 500 every protected
  // route.
  // Checks VERCEL_REGION, not VERCEL or VERCEL_ENV: `vercel env pull` writes both of
  // those into .env.production, which `next start` loads — so a local build still
  // called checkBotId() and 500'd every protected route ("Must be deployed on Vercel
  // to set response headers"; caught by the 2026-09-17 E2E run). Vercel sets
  // VERCEL_REGION only inside the function runtime, and no pulled env file carries it.
  if (!process.env.VERCEL_REGION) return null

  // Deliberately not caught: a misconfigured BotID on Vercel fails closed (500)
  // rather than silently waving traffic through, the FOU-592 failure mode.
  const result = await checkBotId()
  // A bypassed verdict lets a request through without classifying it (e.g. Vercel's
  // automation-bypass header). Logged so an allowed bot is visible in runtime logs
  // rather than indistinguishable from a verified human.
  if (result.bypassed) {
    const reason = 'classificationReason' in result ? result.classificationReason : undefined
    console.warn('[botid] check bypassed', { reason })
  }
  return result.isBot ? NextResponse.json({ error: 'Access denied' }, { status: 403 }) : null
}
