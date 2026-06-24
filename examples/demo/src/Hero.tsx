import { CopyInstall } from './CopyInstall'
import { DriftingGlassMark } from './DriftingGlassMark'

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

      <DriftingGlassMark variant="hero" style={{ width: '100%', height: 'min(72vh, 600px)' }} />
    </section>
  )
}
