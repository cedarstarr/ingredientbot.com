import { NextResponse } from 'next/server'

// Edge-visible country, read by the client-side consent gate. Lives in a route handler so
// the root layout need not call headers() (which would make every page dynamic).
export const dynamic = 'force-dynamic'

export function GET(request: Request) {
  const country = request.headers.get('x-vercel-ip-country') ?? ''
  return NextResponse.json({ country }, { headers: { 'Cache-Control': 'private, no-store' } })
}
