import {
  useEffect,
  useId,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import {
  OPEN_GLASS_DEFAULTS,
  isWebKitEngine,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from './material'
import { OpenGlassFilter } from './OpenGlassFilter'

const IS_WEBKIT = isWebKitEngine()
const DEFAULT_MARGIN = 24

export interface OpenGlassProps {
  /**
   * The look + geometry. Merged over {@link OPEN_GLASS_DEFAULTS}, so you only
   * pass what you want to change (e.g. `{ width: 120, height: 120, scale: 18 }`).
   */
  material?: Partial<OpenGlassMaterial>
  /**
   * Extra content (px) fed to the filter around the pane so the rim refracts
   * real pixels instead of smearing the edge. @default 24
   */
  margin?: number
  /**
   * Content to refract. A **copy** of this node is bent (so it works in Chrome,
   * Safari and Firefox), and `children` render crisp on top. Omit it to refract
   * the `children` themselves, in place. To float a lens over content it doesn't
   * own (a loupe over a photo, a slider track), pass the same node here plus the
   * surface geometry below so the copy lines up with the real thing behind it.
   */
  refract?: ReactNode
  /** Opaque fill behind the refracted copy — the bleed at the rim. @default '#ffffff' */
  behind?: string
  /** Size of the refracted surface. Defaults to the pane size. */
  surfaceWidth?: number
  surfaceHeight?: number
  /** The lens's top-left within that surface, for a positioned/moving lens. @default 0 */
  surfaceX?: number
  surfaceY?: number
  /** The crisp layer drawn on top of the lens (when `refract` is set). */
  children?: ReactNode
  /**
   * Bump this whenever the refracted source moves under the lens. On WebKit it
   * flips an imperceptible opacity so the cached filter re-runs against the live
   * source; a no-op on Chromium. (`surfaceX`/`surfaceY` changes do this too.)
   */
  invalidateKey?: number | string
  className?: string
  style?: CSSProperties
  /** Extra style for the unfiltered rim/glare overlay. */
  overlayStyle?: CSSProperties
}

/**
 * The batteries-included OpenGlass lens. It owns the host layout the raw
 * `<OpenGlassFilter>` needs — the pane + 2·margin box, the clip on the parent,
 * the aligned refracted copy, the unfiltered rim/glare overlay, and the WebKit
 * filter-rebuild handling — so a glass control is a single element.
 *
 * Performance: the displacement map only depends on shape, so moving the lens
 * never rebuilds it; the parent is promoted to its own compositing layer so
 * WebKit caches the filter and only re-runs it when the source actually moves.
 */
export function OpenGlass({
  material: materialProp,
  margin = DEFAULT_MARGIN,
  refract,
  behind = '#ffffff',
  surfaceWidth,
  surfaceHeight,
  surfaceX = 0,
  surfaceY = 0,
  children,
  invalidateKey,
  className,
  style,
  overlayStyle,
}: OpenGlassProps) {
  const material = useMemo<OpenGlassMaterial>(
    () => ({ ...OPEN_GLASS_DEFAULTS, ...materialProp }),
    [materialProp],
  )

  const paneW = material.width
  const paneH = material.height
  const boxW = Math.round(paneW + margin * 2)
  const boxH = Math.round(paneH + margin * 2)
  const paneRadius = openGlassRadius(material)

  const surfW = surfaceWidth ?? paneW
  const surfH = surfaceHeight ?? paneH

  const hasSeparateRefract = refract != null
  const refractContent = hasSeparateRefract ? refract : children

  // WebKit caches filter output by id; rotate it whenever the SHAPE/bevel
  // changes so a stale cached result can't show. Chromium keeps a stable id.
  const baseId = useId().replace(/:/g, '')
  const shapeKey = `${paneW}|${paneH}|${material.borderRadius}|${material.depth}|${material.curvature}|${material.splay}|${material.dome}|${margin}`
  const filterId = useMemo(
    () => `og-${baseId}-${IS_WEBKIT ? Math.random().toString(36).slice(2) : 'f'}`,
    // shapeKey folds in every map input; baseId keeps ids unique per instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [baseId, shapeKey],
  )

  // WebKit only: when the refracted source moves under a static filter root the
  // cached layer won't re-run on its own. An imperceptible opacity flip forces
  // it. (No-op on Chromium, which re-renders the filter region itself.)
  const filteredRef = useRef<HTMLDivElement>(null)
  const nudge = useRef(false)
  useEffect(() => {
    if (!IS_WEBKIT) return
    const el = filteredRef.current
    if (!el) return
    nudge.current = !nudge.current
    el.style.opacity = nudge.current ? '0.9999' : '1'
  }, [invalidateKey, surfaceX, surfaceY])

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        width: paneW,
        height: paneH,
        // Promote to a compositing layer so WebKit renders + caches the child
        // filter (it stays blank in a shared layer) and only re-runs it on
        // change. A caller-supplied 3D transform promotes it just as well.
        transform: 'translateZ(0)',
        willChange: 'transform',
        ...style,
      }}
    >
      <OpenGlassFilter id={filterId} material={material} margin={margin} />

      {/* Filtered window: pane + margin, clipped to the pane shape on this
          parent — clip-path stays off the filtered child (WebKit freezes a
          clip-path + filter layer). */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          left: -margin,
          top: -margin,
          width: boxW,
          height: boxH,
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
            background: behind,
            filter: `url(#${filterId})`,
            WebkitFilter: `url(#${filterId})`,
          }}
        >
          {/* The bent copy, offset so the part under the lens lines up with the
              real content behind it. Blur the source DOM here, never via
              feGaussianBlur (which shifts the refraction in WebKit). */}
          <div
            style={{
              position: 'absolute',
              left: margin - surfaceX,
              top: margin - surfaceY,
              width: surfW,
              height: surfH,
              filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
              WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            }}
          >
            {refractContent}
          </div>
        </div>
      </div>

      {/* Unfiltered rim + glare, sized to the pane. */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          ...openGlassOverlayStyle(material),
          ...overlayStyle,
        }}
      />

      {/* Crisp layer on top (only when refracting a separate node). */}
      {hasSeparateRefract && children != null ? (
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      ) : null}
    </div>
  )
}
