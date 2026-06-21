import { useEffect, useMemo, useRef, useState } from 'react'
import {
  OpenGlassFilter,
  isWebKitEngine,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from 'openglass'
import { Backdrop, PAGE_BASE_COLOR } from './Backdrop'

// ---------------------------------------------------------------------------
// A self-contained OpenGlass lens. Same host pattern as the editor's
// `GlassLensDebug` (examples/reference), minus the live-DOM clone sync: the
// backdrop here is static, so instead of cloning we render a second copy of it
// inside the filtered window, offset so it lines up pixel-for-pixel with the
// real backdrop behind the lens. The displacement filter then bends that copy
// at the rim — exactly the glass refraction, with no MutationObserver needed.
// ---------------------------------------------------------------------------

const IS_WEBKIT = isWebKitEngine()

// Extra backdrop (px) fed to the filter around the pane so the rim samples real
// content instead of smearing the edge.
const MARGIN = 64

function makeFilterId(): string {
  return `og-lens-${Math.random().toString(36).slice(2)}`
}

interface GlassLensProps {
  material: OpenGlassMaterial
  initialPos?: { x: number; y: number }
}

export function GlassLens({ material, initialPos }: GlassLensProps) {
  const [pos, setPos] = useState(() => initialPos ?? {
    x: typeof window === 'undefined' ? 240 : Math.round(window.innerWidth / 2 - material.width / 2),
    y: typeof window === 'undefined' ? 160 : Math.round(window.innerHeight * 0.46 - material.height / 2),
  })
  // Keep a ref in lockstep so the drag handler reads the latest position
  // without re-subscribing listeners.
  const posRef = useRef(pos)
  posRef.current = pos

  const boxW = Math.round(material.width + MARGIN * 2)
  const boxH = Math.round(material.height + MARGIN * 2)
  const paneRadius = openGlassRadius(material)

  // A fresh id rebuilds the displacement map when the shape/bevel changes, and
  // (via webkitEpoch) forces a rebuild after a drag, which WebKit can otherwise
  // serve stale.
  const [webkitEpoch, setWebkitEpoch] = useState(0)
  const filterId = useMemo(
    () => makeFilterId(),
    [material.width, material.height, material.borderRadius, material.depth, material.curvature, material.splay, webkitEpoch],
  )

  // WebKit keeps compositing a STALE filter layer when only the filtered
  // element's DESCENDANTS change — e.g. toggling the source-DOM blur() below at
  // runtime, or the backdrop copy shifting as the lens is dragged. The
  // displacement keeps its previous result, so turning on blur looks like it
  // kills the distortion + chroma. An imperceptible opacity flip on the
  // filtered element invalidates that layer so the filter re-runs against the
  // current source. (GlassLensDebug does this every rAF tick.) An effect is
  // required: it's an imperative, post-paint layer invalidation that can't be
  // expressed declaratively.
  const filteredRef = useRef<HTMLDivElement>(null)
  const nudge = useRef(false)
  useEffect(() => {
    if (!IS_WEBKIT) return
    const el = filteredRef.current
    if (!el) return
    nudge.current = !nudge.current
    el.style.opacity = nudge.current ? '0.9999' : '1'
  }, [material, pos.x, pos.y])

  const onDragPointerDown = (event: React.PointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const origin = posRef.current
    const onMove = (move: PointerEvent) => {
      const next = { x: origin.x + (move.clientX - startX), y: origin.y + (move.clientY - startY) }
      posRef.current = next
      setPos(next)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (IS_WEBKIT) setWebkitEpoch((epoch) => epoch + 1)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // Top-left of the filtered window in screen space.
  const winX = pos.x - MARGIN
  const winY = pos.y - MARGIN

  return (
    <>
      <OpenGlassFilter id={filterId} material={material} margin={MARGIN} />

      {/* Filtered window: pane + margin, clipped to the pane shape on the PARENT
          (keeping clip-path off the filtered element — WebKit freezes a
          clip-path + filter layer). */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: boxW,
          height: boxH,
          transform: `translate3d(${winX}px, ${winY}px, 0)`,
          willChange: 'transform',
          zIndex: 10,
          pointerEvents: 'none',
          clipPath: `inset(${MARGIN}px round ${paneRadius}px)`,
          WebkitClipPath: `inset(${MARGIN}px round ${paneRadius}px)`,
        }}
      >
        {/* The displacement layer. Mirrors GlassLensDebug's `filteredRef`:
            overflow:hidden bounds the FILTER SOURCE to the box (WebKit silently
            skips the filter if the painted source overruns its size ceiling),
            and an opaque background gives WebKit a solid raster to flatten the
            subtree into. The backdrop copy covers it, so it's never seen. */}
        <div
          ref={filteredRef}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            background: PAGE_BASE_COLOR,
            filter: `url(#${filterId})`,
            WebkitFilter: `url(#${filterId})`,
          }}
        >
          {/* Source-DOM blur lives HERE, on a single overflow:visible host that
              is offset so the backdrop copy's viewport origin lands back at the
              real viewport origin (it aligns under the lens). This mirrors
              GlassLensDebug's `cloneHost` exactly. The blur must NOT sit on an
              overflow:hidden / box-clipped element: that promotes it to its own
              composited layer on WebKit, the parent displacement then samples an
              empty source, and the distortion + chroma vanish while blur stays.
              CSS blur (not feGaussianBlur, which shifts the refraction). */}
          <div
            style={{
              position: 'absolute',
              left: -winX,
              top: -winY,
              width: '100vw',
              height: '100vh',
              overflow: 'visible',
              pointerEvents: 'none',
              filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
              WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            }}
          >
            <Backdrop flat />
          </div>
        </div>
      </div>

      {/* Rim + glare overlay (unfiltered). Also the drag handle. */}
      <div
        onPointerDown={onDragPointerDown}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          width: material.width,
          height: material.height,
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          willChange: 'transform',
          zIndex: 11,
          cursor: 'grab',
          touchAction: 'none',
          ...openGlassOverlayStyle(material),
        }}
      />
    </>
  )
}
