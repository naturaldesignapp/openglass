import type { CSSProperties } from 'react'

// A static, full-bleed scene with lots of edges and colour so the lens has
// something interesting to bend. It fills its positioned parent (inset: 0) and
// is rendered twice: once as the page background, and once (aligned) inside the
// filtered window so the lens refracts an exact copy of what's behind it.

const ORB_STYLE: CSSProperties = {
  position: 'absolute',
  borderRadius: '50%',
  filter: 'blur(2px)',
}

const CHIPS = [
  'feDisplacementMap',
  'rounded-rect SDF',
  'chromatic aberration',
  'WebKit-safe',
  'SVG · WebGL',
  'zero deps',
]

export function Backdrop() {
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background:
          'radial-gradient(120% 120% at 15% 10%, #1b2a4a 0%, #0a0d1a 45%, #050507 100%)',
      }}
    >
      {/* Colour orbs */}
      <div style={{ ...ORB_STYLE, width: 520, height: 520, left: '6%', top: '12%', background: 'radial-gradient(circle, rgba(99,102,241,0.55), transparent 65%)' }} />
      <div style={{ ...ORB_STYLE, width: 440, height: 440, right: '8%', top: '8%', background: 'radial-gradient(circle, rgba(236,72,153,0.5), transparent 65%)' }} />
      <div style={{ ...ORB_STYLE, width: 600, height: 600, right: '12%', bottom: '-6%', background: 'radial-gradient(circle, rgba(45,212,191,0.45), transparent 65%)' }} />
      <div style={{ ...ORB_STYLE, width: 360, height: 360, left: '20%', bottom: '4%', background: 'radial-gradient(circle, rgba(250,204,21,0.4), transparent 65%)' }} />

      {/* Fine grid — refraction makes the lines ripple at the rim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          maskImage: 'radial-gradient(120% 120% at 50% 40%, #000 55%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(120% 120% at 50% 40%, #000 55%, transparent 100%)',
        }}
      />

      {/* Hero copy */}
      <div style={{ position: 'absolute', left: '7%', top: '28%', maxWidth: 760 }}>
        <div
          style={{
            fontSize: 'clamp(64px, 11vw, 168px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 0.92,
            background: 'linear-gradient(95deg, #ffffff, #a5b4fc 55%, #5eead4)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Open
          <br />
          Glass
        </div>
        <p
          style={{
            marginTop: 24,
            fontSize: 'clamp(15px, 1.6vw, 22px)',
            lineHeight: 1.5,
            color: 'rgba(255,255,255,0.72)',
            maxWidth: 540,
          }}
        >
          A portable glass material for the web. One displacement map drives an SVG
          refraction filter and a rim&nbsp;+&nbsp;glare overlay — drag the lens and
          tune it live.
        </p>
      </div>

      {/* Chips scattered to give the rim detail to refract */}
      <div
        style={{
          position: 'absolute',
          right: '6%',
          top: '34%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 14,
        }}
      >
        {CHIPS.map((label, i) => (
          <span
            key={label}
            style={{
              padding: '8px 16px',
              borderRadius: 999,
              fontSize: 14,
              fontWeight: 500,
              whiteSpace: 'nowrap',
              color: 'rgba(255,255,255,0.85)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(6px)',
              transform: `translateX(${(i % 3) * -28}px)`,
            }}
          >
            {label}
          </span>
        ))}
      </div>

      {/* Big numerals near the bottom for high-contrast refraction targets */}
      <div
        style={{
          position: 'absolute',
          left: '8%',
          bottom: '6%',
          display: 'flex',
          gap: 36,
          fontSize: 'clamp(40px, 6vw, 92px)',
          fontWeight: 800,
          color: 'rgba(255,255,255,0.1)',
          letterSpacing: '-0.04em',
        }}
      >
        <span>0.1.0</span>
        <span style={{ color: 'rgba(125,211,252,0.16)' }}>MIT</span>
        <span style={{ color: 'rgba(236,72,153,0.16)' }}>R/G</span>
      </div>
    </div>
  )
}
