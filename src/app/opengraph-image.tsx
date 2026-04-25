import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Robot Food — AI Recipe Generator'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1008 50%, #0a0a0a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle grid overlay */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage:
              'linear-gradient(rgba(251,146,60,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(251,146,60,0.03) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />

        {/* Warm glow */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '300px',
            background: 'radial-gradient(ellipse, rgba(251,146,60,0.12) 0%, transparent 70%)',
          }}
        />

        {/* Icon + wordmark row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '32px',
          }}
        >
          {/* Chef hat icon approximated with SVG */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(251,146,60,0.15)',
              border: '2px solid rgba(251,146,60,0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
            }}
          >
            🍳
          </div>
          <span
            style={{
              fontSize: '28px',
              fontWeight: '700',
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            Robot Food
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: '72px',
            fontWeight: '800',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: '1.1',
            margin: '0 0 20px 0',
            padding: '0 80px',
            letterSpacing: '-0.02em',
          }}
        >
          What&apos;s in your fridge?
        </h1>

        {/* Subline */}
        <p
          style={{
            fontSize: '28px',
            color: 'rgba(255,255,255,0.55)',
            textAlign: 'center',
            margin: '0 0 40px 0',
            padding: '0 120px',
            lineHeight: '1.4',
          }}
        >
          Tell it what&apos;s in your fridge. Get instant recipe ideas.
        </p>

        {/* CTA pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'rgba(251,146,60,0.15)',
            border: '1.5px solid rgba(251,146,60,0.5)',
            borderRadius: '999px',
            padding: '12px 28px',
          }}
        >
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#fb923c',
            }}
          />
          <span
            style={{
              fontSize: '20px',
              fontWeight: '600',
              color: '#fb923c',
              letterSpacing: '0.01em',
            }}
          >
            Powered by Claude AI
          </span>
        </div>
      </div>
    ),
    { ...size }
  )
}
