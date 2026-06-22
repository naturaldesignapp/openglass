import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from 'react'
import {
  OpenGlassFilter,
  isWebKitEngine,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from 'openglass'

const IS_WEBKIT = isWebKitEngine()

interface RefractingLensProps {
  material: OpenGlassMaterial
  margin: number
  filterId: string
  /** Top-left of the filtered window (pane − margin) in the parent's coords. */
  winX: number
  winY: number
  /** Size of the scene copy (normally the stage/viewport size). */
  sceneWidth: number
  sceneHeight: number
  /** Opaque base painted behind the refracted copy; the copy covers it. */
  baseColor?: string
  /** Renders the scene to refract. `flat` drops nested filters for the copy. */
  renderScene: (flat: boolean) => ReactNode
  position?: 'absolute' | 'fixed'
  zIndex?: number
  /**
   * Any value that changes when the source under the lens moves (scroll
   * progress, drag position, material). On WebKit, a change flips an
   * imperceptible opacity so the filter layer re-runs against the live source.
   */
  invalidateKey?: number | string
  /** Extra style + interactions for the (unfiltered) overlay / drag handle. */
  overlayStyle?: CSSProperties
  onOverlayPointerDown?: (event: PointerEvent) => void
}

/**
 * One OpenGlass pane: the SVG filter, a filtered window holding an aligned copy
 * of the scene (so the rim refracts what's "behind" the glass), and the
 * unfiltered rim/glare overlay on top. Host follows the OpenGlass layout rules
 * (box = pane + 2·margin, clip on the parent, overlay sized to the pane).
 */
export function RefractingLens({
  material,
  margin,
  filterId,
  winX,
  winY,
  sceneWidth,
  sceneHeight,
  baseColor = '#ffffff',
  renderScene,
  position = 'absolute',
  zIndex = 10,
  invalidateKey,
  overlayStyle,
  onOverlayPointerDown,
}: RefractingLensProps) {
  const boxW = Math.round(material.width + margin * 2)
  const boxH = Math.round(material.height + margin * 2)
  const paneRadius = openGlassRadius(material)

  const filteredRef = useRef<HTMLDivElement>(null)
  const nudge = useRef(false)
  // Imperative, post-paint layer invalidation for WebKit — can't be expressed
  // declaratively, so an effect is the right tool here.
  useEffect(() => {
    if (!IS_WEBKIT) return
    const el = filteredRef.current
    if (!el) return
    nudge.current = !nudge.current
    el.style.opacity = nudge.current ? '0.9999' : '1'
  }, [invalidateKey])

  return (
    <>
      <OpenGlassFilter id={filterId} material={material} margin={margin} />

      {/* Filtered window: pane + margin, clipped to the pane shape on this
          (parent) element — clip-path stays off the filtered child so WebKit
          doesn't freeze a clip-path + filter layer. */}
      <div
        style={{
          position,
          left: 0,
          top: 0,
          width: boxW,
          height: boxH,
          transform: `translate3d(${winX}px, ${winY}px, 0)`,
          willChange: 'transform',
          zIndex,
          pointerEvents: 'none',
          clipPath: `inset(${margin}px round ${paneRadius}px)`,
          WebkitClipPath: `inset(${margin}px round ${paneRadius}px)`,
        }}
      >
        <div
          ref={filteredRef}
          style={{
            position: 'absolute',
            inset: 0,
            overflow: 'hidden',
            background: baseColor,
            filter: `url(#${filterId})`,
            WebkitFilter: `url(#${filterId})`,
          }}
        >
          {/* The aligned scene copy. Offset so its origin lands back at the
              parent origin (under the lens), then optionally blurred at the
              source (never via feGaussianBlur, which shifts the refraction). */}
          <div
            style={{
              position: 'absolute',
              left: -winX,
              top: -winY,
              width: sceneWidth,
              height: sceneHeight,
              overflow: 'visible',
              pointerEvents: 'none',
              filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
              WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            }}
          >
            {renderScene(true)}
          </div>
        </div>
      </div>

      {/* Unfiltered rim + glare, sized to the pane. Also the drag handle. */}
      <div
        onPointerDown={onOverlayPointerDown}
        style={{
          position,
          left: 0,
          top: 0,
          width: material.width,
          height: material.height,
          transform: `translate3d(${winX + margin}px, ${winY + margin}px, 0)`,
          willChange: 'transform',
          zIndex: zIndex + 1,
          ...openGlassOverlayStyle(material),
          ...overlayStyle,
        }}
      />
    </>
  )
}
