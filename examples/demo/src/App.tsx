import { useState } from 'react'
import { OPEN_GLASS_DEFAULTS, type OpenGlassMaterial } from 'openglass'
import { Backdrop } from './Backdrop'
import { GlassLens } from './GlassLens'
import { GlassTuner } from './GlassTuner'

export function App() {
  const [material, setMaterial] = useState<OpenGlassMaterial>(OPEN_GLASS_DEFAULTS)

  return (
    <>
      {/* Page background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Backdrop />
      </div>

      <GlassLens material={material} />
      <GlassTuner material={material} onChange={setMaterial} />

      {/* Top bar: title + repo link + hint */}
      <header
        style={{
          position: 'fixed',
          top: 18,
          left: 22,
          right: 22,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
          fontSize: 13,
        }}
      >
        <span style={{ pointerEvents: 'auto', color: 'rgba(255,255,255,0.55)' }}>
          Drag the lens · tune the material below
        </span>
        <a
          className="og-link"
          href="https://github.com/naturaldesignapp/openglass"
          target="_blank"
          rel="noreferrer"
          style={{ pointerEvents: 'auto' }}
        >
          github.com/naturaldesignapp/openglass
        </a>
      </header>
    </>
  )
}
