import { openGlassOverlayStyle, type OpenGlassMaterial } from 'openglass'
import { CopyInstall } from './CopyInstall'

// A decorative glass pebble (overlay only — the real refraction lives in the
// story stage below). Reuses the package's own overlay so the brand object is
// literally made of OpenGlass.
const PEBBLE: OpenGlassMaterial = {
  width: 188,
  height: 188,
  borderRadius: 94,
  scale: 30,
  depth: 41,
  curvature: 2.8,
  splay: -1,
  dome: 0.45,
  chroma: 0.06,
  blur: 0,
  glow: 0.34,
  edgeHighlight: 0.6,
  specularAngle: 325,
}

export function Hero() {
  return (
    <section id="top" className="og-hero">
      <div style={{ minWidth: 0 }}>
        <h1 className="nd-display" style={{ maxWidth: 520, fontSize: 'clamp(36px, 5vw, 68px)', lineHeight: 1.02 }}>
          Open source glass
          for the web.
        </h1>
        <p style={{ marginTop: 22, maxWidth: '46ch', fontSize: 'clamp(16px, 1.7vw, 20px)', lineHeight: 1.45, color: 'var(--nd-muted)' }}>
          Refract live DOM content with one material object and plain CSS. The
          same pipeline runs in Chromium, Gecko, and WebKit.
        </p>
        <div style={{ marginTop: 30, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
          <CopyInstall variant="solid" />
          <a className="nd-pill" href="#try" style={{ borderColor: 'var(--nd-hair)' }}>
            Try it
          </a>
        </div>
      </div>

      {/* Mini Natural Design canvas with a glass pebble resting on it. */}
      <div
        aria-hidden
        style={{
          position: 'relative',
          width: 'min(100%, 520px)',
          aspectRatio: '1.5',
          marginInline: 'auto',
          overflow: 'hidden',
          background: 'var(--nd-soft)',
          border: '1px solid #d6d6d0',
          borderRadius: 3,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, height: 32, padding: '0 13px', background: '#ecece8', borderBottom: '1px solid #d0d0ca' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b8b8b2' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b8b8b2' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b8b8b2' }} />
        </div>
        <div
          style={{
            position: 'absolute',
            inset: '32px 0 0',
            display: 'grid',
            placeItems: 'center',
            backgroundImage: 'linear-gradient(#d5d5cf 1px, transparent 1px), linear-gradient(90deg, #d5d5cf 1px, transparent 1px)',
            backgroundSize: '26px 26px',
            backgroundColor: '#dddddd',
          }}
        >
          <div
            style={{
              ...openGlassOverlayStyle(PEBBLE),
              width: PEBBLE.width,
              height: PEBBLE.height,
              background: `radial-gradient(120% 120% at 30% 22%, rgba(37,146,254,0.32), rgba(233,219,255,0.22) 60%, rgba(255,255,255,0.1)), ${(openGlassOverlayStyle(PEBBLE).background as string)}`,
            }}
          />
        </div>
      </div>
    </section>
  )
}
