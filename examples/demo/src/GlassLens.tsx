import { useMemo, useRef, useState } from 'react'
import {
  OpenGlassFilter,
  isWebKitEngine,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from 'openglass'
import { Backdrop } from './Backdrop'

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
}

export function GlassLens({ material }: GlassLensProps) {
  const [pos, setPos] = useState(() => ({
    x: typeof window === 'undefined' ? 240 : Math.round(window.innerWidth / 2 - material.width / 2),
    y: typeof window === 'undefined' ? 160 : Math.round(window.innerHeight * 0.46 - material.height / 2),
  }))
  // Keep a ref in lockstep so the drag handler reads the latest position
  // without re-subscribing listeners.
  const posRef = useRef(pos)
  posRef.current = pos

  const boxW = Math.round(material.width + MARGIN * 2)
  const boxH = Math.round(material.height + MARGIN * 2)
  const paneRadius = openGlassRadius(material)

  // WebKit caches filter output by id and can freeze/drop it after a transform
  // drag; a fresh id forces a rebuild. Shape/bevel changes also need a new map.
  const [webkitEpoch, setWebkitEpoch] = useState(0)
  const filterId = useMemo(
    () => makeFilterId(),
    [material.width, material.height, material.borderRadius, material.depth, material.curvature, material.splay, webkitEpoch],
  )

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
        <div
          style={{
            position: 'absolute',
            inset: 0,
            // Bound the filter's painted source to the box so WebKit doesn't
            // skip the filter when the backdrop copy overflows.
            overflow: 'hidden',
            filter: `url(#${filterId})`,
            WebkitFilter: `url(#${filterId})`,
          }}
        >
          {/* A copy of the backdrop, shifted so its viewport origin lands at the
              real viewport origin — it aligns under the lens. Blur the source
              DOM (not feGaussianBlur) so WebKit doesn't shift the refraction. */}
          <div
            style={{
              position: 'absolute',
              left: -winX,
              top: -winY,
              width: '100vw',
              height: '100vh',
              filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
              WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            }}
          >
            <Backdrop />
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
