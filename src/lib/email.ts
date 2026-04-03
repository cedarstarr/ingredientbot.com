import { SendMailClient } from 'zeptomail'
import { renderWelcomeEmail } from '@/emails/welcome'
import { renderPasswordResetEmail } from '@/emails/password-reset'
import { renderVerifyEmail } from '@/emails/verify-email'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3010'
const EMAIL_FROM = process.env.EMAIL_FROM || 'IngredientBot <hello@ingredientbot.com>'

function getMailClient(): SendMailClient | null {
  const apiKey = process.env.ZEPTOMAIL_API_KEY
  if (!apiKey) return null
  return new SendMailClient({ url: 'api.zeptomail.com/', token: apiKey })
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

async function sendEmail(opts: { to: string; subject: string; html: string }) {
  const client = getMailClient()
  if (!client) {
    console.log('[email] ZeptoMail not configured, logging email:')
    console.log(`  To: ${opts.to}`)
    console.log(`  Subject: ${opts.subject}`)
    return
  }
  const fromMatch = EMAIL_FROM.match(/^(.*?)\s*<(.+?)>$/)
  const fromAddr = fromMatch
    ? { name: fromMatch[1].trim(), address: fromMatch[2].trim() }
    : { address: EMAIL_FROM, name: '' }
  await client.sendMail({
    from: fromAddr,
    to: [{ email_address: { address: opts.to, name: '' } }],
    subject: opts.subject,
    htmlbody: opts.html,
  })
}

export async function sendWelcomeEmail(to: string, name: string | null, verifyUrl?: string) {
  const html = await renderWelcomeEmail({
    name: name || 'there',
    siteUrl: SITE_URL,
    verifyUrl,
  })
  await sendEmail({
    to,
    subject: 'Welcome to Robot Food!',
    html,
  })
}

export async function sendVerificationEmail(email: string, token: string) {
  const url = `${SITE_URL}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(email)}`
  const html = await renderVerifyEmail({ url, siteName: 'Robot Food' })
  await sendEmail({
    to: email,
    subject: 'Verify your Robot Food email',
    html,
  })
}

export async function sendPasswordResetEmail(email: string, token: string) {
  const url = `${SITE_URL}/reset-password?token=${token}`
  const html = await renderPasswordResetEmail({ url, siteName: 'Robot Food' })
  await sendEmail({
    to: email,
    subject: 'Reset your Robot Food password',
    html,
  })
}

export async function sendPasswordChangedEmail(email: string, name?: string) {
  const displayName = name || 'there'
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h2>Your password has been changed, ${escapeHtml(displayName)}!</h2>
  <p style="color:#555;">Your Robot Food password was recently changed.</p>
  <p>If you did not make this change, please contact us immediately.</p>
  <p style="margin-top:24px;">
    <a href="${SITE_URL}/kitchen" style="background:#e57c2c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Go to Kitchen</a>
  </p>
  <p style="margin-top:32px;color:#999;font-size:13px;"><a href="${SITE_URL}" style="color:#999;">ingredientbot.com</a></p>
</body>
</html>`
  await sendEmail({
    to: email,
    subject: 'Your Robot Food password has been changed',
    html,
  })
}

export async function sendEmailChangeVerificationEmail(toEmail: string, token: string) {
  const url = `${SITE_URL}/api/auth/verify-email-change?token=${token}`
  const escaped = toEmail
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h2 style="color:#e57c2c;">Verify your new email address</h2>
  <p style="color:#555;">You requested to change your Robot Food email to <strong>${escaped}</strong>.</p>
  <p>Click the button below to confirm. This link expires in 1 hour.</p>
  <p style="margin-top:16px;">
    <a href="${url}" style="background:#e57c2c;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">Confirm Email Change</a>
  </p>
  <p style="margin-top:24px;color:#777;font-size:13px;">If you did not request this change, you can safely ignore this email.</p>
  <p style="margin-top:32px;color:#999;font-size:13px;"><a href="${SITE_URL}" style="color:#999;">ingredientbot.com</a></p>
</body>
</html>`
  await sendEmail({ to: toEmail, subject: 'Confirm your new Robot Food email address', html })
}

export async function sendAccountDeletedEmail(email: string, name?: string) {
  const displayName = name || 'there'
  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <h2>Account deleted, ${escapeHtml(displayName)}</h2>
  <p style="color:#555;">Your Robot Food account has been permanently deleted.</p>
  <p>All your saved recipes have been removed. We hope to cook with you again someday!</p>
  <p style="margin-top:32px;color:#999;font-size:13px;"><a href="${SITE_URL}" style="color:#999;">ingredientbot.com</a></p>
</body>
</html>`
  await sendEmail({
    to: email,
    subject: 'Your Robot Food account has been deleted',
    html,
  })
}
