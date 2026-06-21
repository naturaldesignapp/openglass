import { useEffect, useState } from 'react'
import { OPEN_GLASS_DEFAULTS, OPEN_GLASS_PARAMS, type OpenGlassMaterial } from 'openglass'
import { Backdrop } from './Backdrop'
import { GlassLens } from './GlassLens'
import { GlassTuner } from './GlassTuner'

// Let any material field be preset from the query string, e.g. `?blur=6&scale=50`.
// Handy for sharing a tuned look (and for testing specific values).
function readMaterialFromQuery(): OpenGlassMaterial {
  const material = { ...OPEN_GLASS_DEFAULTS }
  if (typeof window === 'undefined') return material
  const params = new URLSearchParams(window.location.search)
  for (const param of OPEN_GLASS_PARAMS) {
    const raw = params.get(param.key)
    if (raw == null) continue
    const value = Number(raw)
    if (Number.isFinite(value)) material[param.key] = value
  }
  return material
}

/** Optional initial lens position from `?lensX=&lensY=` (screen px). */
function readLensPosFromQuery(): { x: number; y: number } | undefined {
  if (typeof window === 'undefined') return undefined
  const params = new URLSearchParams(window.location.search)
  const x = Number(params.get('lensX'))
  const y = Number(params.get('lensY'))
  if (!params.has('lensX') || !params.has('lensY') || !Number.isFinite(x) || !Number.isFinite(y)) return undefined
  return { x, y }
}

export function App() {
  const [material, setMaterial] = useState<OpenGlassMaterial>(readMaterialFromQuery)

  // TEMP verification hook: `?autoblur=N` flips blur from 0 to N ~1.2s after
  // mount, reproducing a runtime slider change (to test the WebKit cache bust).
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get('autoblur')
    if (raw == null) return
    const n = Number(raw)
    const t = window.setTimeout(() => setMaterial((m) => ({ ...m, blur: Number.isFinite(n) ? n : 6 })), 1200)
    return () => window.clearTimeout(t)
  }, [])

  return (
    <>
      {/* Page background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Backdrop />
      </div>

      <GlassLens material={material} initialPos={readLensPosFromQuery()} />
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
