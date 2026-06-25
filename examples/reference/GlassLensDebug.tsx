// ---------------------------------------------------------------------------
// REFERENCE ONLY — not part of the runnable build.
//
// This is the original editor host for the OpenGlass lens. It is coupled to the
// editor (it clones the live `.nd-stage` DOM and imports `./store`,
// `./primitives`, `@naturaldesign/core`, `../editor/scene-graph`), so it will
// NOT compile or run standalone. It is kept here as the canonical example of
// the host pattern — clone sync, drag, WebKit handling, and the tuning panel.
//
// For a self-contained, runnable version of this pattern see
// `examples/demo/src/RefractingLens.tsx`.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  OPEN_GLASS_DEFAULTS,
  OPEN_GLASS_PARAMS,
  OpenGlassFilter,
  isWebKitEngine,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from 'openglass'
import { DEFAULT_PAGE_BACKGROUND_COLOR } from './store'
import { Slider } from './primitives'

// ---------------------------------------------------------------------------
// OpenGlass lens over the live canvas — refracts the REAL canvas DOM.
//
// It windows onto a live clone of the `.nd-stage` shape tree, so what you see
// inside is exactly what's on canvas (real fonts, images, effects), then bends
// it with an SVG feDisplacementMap filter built from the OpenGlass material.
//
// The material itself (shape, bevel, chroma, highlights) lives in
// `@naturaldesign/glass` so it can ship as a standalone package; this file is
// the editor-specific host: clone sync, drag, and the tuning panel.
// ---------------------------------------------------------------------------

const IS_WEBKIT = isWebKitEngine()

/**
 * Extra content (px) rendered around the pane and fed to the filter, so the
 * displacement near the rim samples real content instead of smearing the edge.
 * Also keeps the filtered source small (pane + 2*MARGIN per axis).
 */
const MARGIN = 64

function makeLensFilterId(): string {
  return `glass-lens-${Math.random().toString(36).slice(2)}`
}

export function GlassLensDebug() {
  const [material, setMaterial] = useState<OpenGlassMaterial>(OPEN_GLASS_DEFAULTS)
  // Start in the top-left of the canvas area, clear of the minimap (which
  // opens at the pointer, typically mid-screen) and the bottom tuner panel.
  const [pos, setPos] = useState(() => ({ x: 280, y: 110 }))
  const posRef = useRef(pos)
  posRef.current = pos

  const cloneHostRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const filteredRef = useRef<HTMLDivElement>(null)

  const boxW = Math.round(material.width + MARGIN * 2)
  const boxH = Math.round(material.height + MARGIN * 2)
  const paneRadius = openGlassRadius(material)

  // WebKit caches filter output by ID and can drop or freeze it after drags
  // and re-clones; a fresh ID (on any shape/bevel change or epoch bump)
  // forces a rebuild.
  const [webkitEpoch, setWebkitEpoch] = useState(0)
  const filterId = useMemo(
    () => makeLensFilterId(),
    [material.width, material.height, material.borderRadius, material.depth, material.curvature, material.splay, webkitEpoch],
  )

  // Keep the clone aligned + in sync with the real canvas.
  useEffect(() => {
    const stage = document.querySelector('.nd-stage') as HTMLElement | null
    const container = stage?.parentElement as HTMLElement | null
    const pageSurface = container?.querySelector('.nd-page-color-surface') as HTMLElement | null
    const wrapper = wrapperRef.current
    const cloneHost = cloneHostRef.current
    const filtered = filteredRef.current
    if (!stage || !container || !wrapper || !cloneHost || !filtered) return

    let recloneTimer: number | null = null
    const reclone = () => {
      recloneTimer = null
      const fragment = document.createDocumentFragment()
      for (const child of Array.from(stage.children)) {
        fragment.appendChild(child.cloneNode(true))
      }
      // Strip per-node glass layers: each carries an <svg><filter id> and cloning
      // them duplicates those ids in the document, which makes WebKit mis-resolve
      // the real in-stage `filter: url(#id)` and render nothing.
      for (const layer of Array.from(fragment.querySelectorAll('.nd-node-glass'))) {
        layer.remove()
      }
      wrapper.replaceChildren(fragment)
      // The filter's source content changed wholesale — rotate the ID so
      // WebKit can't serve a cached filter result built from the old clone.
      if (IS_WEBKIT) setWebkitEpoch((epoch) => epoch + 1)
    }

    const observer = new MutationObserver((mutations) => {
      // Ignore the stage's own transform changes (pan/zoom) — those are tracked
      // live via the rAF transform copy; only re-clone on real content changes.
      const contentChanged = mutations.some(
        (mutation) => mutation.type !== 'attributes' || mutation.target !== stage,
      )
      if (contentChanged && recloneTimer == null) {
        recloneTimer = window.setTimeout(reclone, 120)
      }
    })
    observer.observe(stage, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    })
    reclone()

    let rafId = 0
    // Cache last-written values: style writes every frame are wasted work on
    // Chromium and actively harmful on WebKit (each one invalidates the
    // filtered layer even when nothing moved).
    let lastLeft = ''
    let lastTop = ''
    let lastWidth = ''
    let lastHeight = ''
    let lastTransform = ''
    let lastBackground = ''
    let nudgeToggle = false
    const tick = () => {
      const rect = container.getBoundingClientRect()
      const { x, y } = posRef.current
      let changed = false
      // cloneHost (0,0) should land on the canvas container origin.
      const left = `${rect.left - x + MARGIN}px`
      const top = `${rect.top - y + MARGIN}px`
      const width = `${rect.width}px`
      const height = `${rect.height}px`
      if (left !== lastLeft) {
        cloneHost.style.left = left
        lastLeft = left
        changed = true
      }
      if (top !== lastTop) {
        cloneHost.style.top = top
        lastTop = top
        changed = true
      }
      if (width !== lastWidth) {
        cloneHost.style.width = width
        lastWidth = width
        changed = true
      }
      if (height !== lastHeight) {
        cloneHost.style.height = height
        lastHeight = height
        changed = true
      }
      const transform = getComputedStyle(stage).transform
      if (transform !== lastTransform) {
        wrapper.style.transform = transform
        lastTransform = transform
        changed = true
      }
      if (pageSurface) {
        const background = getComputedStyle(pageSurface).backgroundColor
        if (background !== lastBackground) {
          filtered.style.background = background
          lastBackground = background
          changed = true
        }
      }
      // WebKit sometimes keeps compositing a stale filter layer when only the
      // filtered element's DESCENDANTS change (clone moved under a static
      // filter root). An imperceptible opacity flip on the filtered element
      // itself invalidates that layer so the filter re-runs this frame.
      if (IS_WEBKIT && changed) {
        nudgeToggle = !nudgeToggle
        filtered.style.opacity = nudgeToggle ? '0.9999' : '1'
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      if (recloneTimer != null) window.clearTimeout(recloneTimer)
    }
  }, [])

  const onDragPointerDown = (event: React.PointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const origin = posRef.current
    const onMove = (move: PointerEvent) => {
      const next = { x: origin.x + (move.clientX - startX), y: origin.y + (move.clientY - startY) }
      // Keep posRef in lockstep so the rAF counter-moves the clone in the SAME
      // frame the lens window moves — otherwise the content lags by a frame.
      posRef.current = next
      setPos(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      // WebKit can drop the filter entirely after a transform drag (flat,
      // unfiltered content). Rotating the ID on drag end rebuilds it.
      if (IS_WEBKIT) setWebkitEpoch((epoch) => epoch + 1)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  return createPortal(
    <>
      <OpenGlassFilter id={filterId} material={material} margin={MARGIN} />

      {/* Filtered window: pane + margin of opaque, real canvas content. The
          filtered element sits at its host's (0,0) — no nested negative offset —
          so the filter's userSpaceOnUse origin lines up with it in every engine.
          The pane shape is cut with clip-path (inset by MARGIN) on this PARENT. */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: boxW,
          height: boxH,
          transform: `translate3d(${pos.x - MARGIN}px, ${pos.y - MARGIN}px, 0)`,
          willChange: 'transform',
          // Below the radial menu layer (10005) and minimap (10010).
          zIndex: 10000,
          pointerEvents: 'none',
          // Clip the pane shape here, on the PARENT — keeping clip-path off the
          // filtered element. WebKit caches a clip-path+filter layer and stops
          // updating it live, which froze + offset the content.
          clipPath: `inset(${MARGIN}px round ${paneRadius}px)`,
          WebkitClipPath: `inset(${MARGIN}px round ${paneRadius}px)`,
        }}
      >
        <div
          ref={filteredRef}
          style={{
            position: 'absolute',
            inset: 0,
            background: DEFAULT_PAGE_BACKGROUND_COLOR,
            // Bound the filter's painted source to the box. Without this the
            // clone subtree overflows by the whole canvas and WebKit silently
            // skips the filter (source exceeds its size ceiling) — content
            // renders flat. Chromium already crops at the filter region, so
            // this is a no-op there beyond saving raster work.
            overflow: 'hidden',
            filter: `url(#${filterId})`,
            WebkitFilter: `url(#${filterId})`,
          }}
        >
          <div
            ref={cloneHostRef}
            style={{
              position: 'absolute',
              overflow: 'visible',
              pointerEvents: 'none',
              // Blur the source DOM with CSS, not feGaussianBlur in the SVG filter
              // — WebKit's blur shifts the refracted backdrop, CSS blur doesn't.
              filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
              WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            }}
          >
            <div ref={wrapperRef} style={{ position: 'absolute', left: 0, top: 0, transformOrigin: '0 0' }} />
          </div>
        </div>
      </div>

      {/* Glass highlight + rim (not filtered) — also the drag handle. */}
      <div
        aria-hidden
        onPointerDown={onDragPointerDown}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: material.width,
          height: material.height,
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          willChange: 'transform',
          zIndex: 10001,
          cursor: 'grab',
          ...openGlassOverlayStyle(material),
        }}
      />

      <GlassLensTuner material={material} onChange={setMaterial} />
    </>,
    document.body,
  )
}

// ---------------------------------------------------------------------------
// Tuning panel — dial in the OpenGlass material live.
// ---------------------------------------------------------------------------

interface GlassLensTunerProps {
  material: OpenGlassMaterial
  onChange: (next: OpenGlassMaterial) => void
}

function GlassLensTuner({ material, onChange }: GlassLensTunerProps) {
  const [copied, setCopied] = useState(false)

  const copyValues = () => {
    void navigator.clipboard?.writeText(JSON.stringify(material, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 10002,
        width: 620,
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 18px 16px',
        borderRadius: 14,
        background: 'rgba(24, 24, 26, 0.92)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontWeight: 600, letterSpacing: 0.2 }}>OpenGlass</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={tunerButtonStyle} onClick={() => onChange(OPEN_GLASS_DEFAULTS)}>
            Reset
          </button>
          <button type="button" style={tunerButtonStyle} onClick={copyValues}>
            {copied ? 'Copied' : 'Copy values'}
          </button>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          columnGap: 28,
          rowGap: 8,
        }}
      >
        {OPEN_GLASS_PARAMS.map((param) => {
          const value = material[param.key] ?? OPEN_GLASS_DEFAULTS[param.key]
          const factor = 10 ** param.decimals
          return (
            <div
              key={param.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '96px 1fr 44px',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ color: 'rgba(255, 255, 255, 0.5)', whiteSpace: 'nowrap' }}>{param.label}</span>
              <Slider
                value={value}
                min={param.min}
                max={param.max}
                onChange={(next) => onChange({ ...material, [param.key]: Math.round(next * factor) / factor })}
              />
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {value.toFixed(param.decimals)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const tunerButtonStyle: React.CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(255, 255, 255, 0.12)',
  borderRadius: 7,
  background: 'rgba(255, 255, 255, 0.06)',
  color: 'rgba(255, 255, 255, 0.8)',
  fontSize: 11,
  padding: '3px 10px',
  cursor: 'pointer',
}
