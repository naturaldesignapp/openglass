import { useId, useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import {
  isWebKitEngine,
  makeOpenGlassDisplacementMap,
  openGlassOverlayStyle,
  type OpenGlassMaterial,
} from './material'
import type { GlassMotionValue } from './motion'

const IS_WEBKIT = isWebKitEngine()

export interface GlassControlLensProps {
  /** Base optics. `width`/`height`/`borderRadius` are driven by the motion values below. */
  material: OpenGlassMaterial
  /** The full control surface the lens floats inside. */
  boxW: number
  boxH: number
  /** Opaque bleed colour behind the refracted copy. */
  behind: string
  /** A copy of the surface, painted at its natural position, filling `boxW`×`boxH`. */
  refract: ReactNode

  /** Lens centre as a fraction of the box (x animates; y is usually fixed). */
  centerX: GlassMotionValue
  centerY?: number
  /** Animated lens geometry, in px. */
  lensW: GlassMotionValue
  lensH: GlassMotionValue
  radius: GlassMotionValue
  /** Optional squash-stretch from {@link useLensWobble}. */
  stretch?: GlassMotionValue
  /** Width multiplier applied to `stretch`. @default -0.2 */
  stretchWidthFactor?: number
  /** Height multiplier applied to `stretch`. @default 0.4 */
  stretchHeightFactor?: number
  /** Optional lower bound for stretch, useful when spring overshoot is undesirable. */
  stretchMin?: number
  /** Optional upper bound for stretch. */
  stretchMax?: number

  /** White-puck opacity: 1 at rest (solid pill), 0 when fully glass. */
  tintOpacity: GlassMotionValue
  tintColor?: string
  /** Optional content shown over the solid resting tint, fading out with it. */
  restContent?: ReactNode
  /** Expanded-lens drop shadow, crossfaded against the resting-puck shadow. */
  shadowOpacity: GlassMotionValue
  restShadowOpacity: GlassMotionValue
  edgeShadow: string
  restEdgeShadow: string
}

/**
 * The moving part of a glass control: a pill that sits as a solid white puck at
 * rest and blooms into a refracting OpenGlass lens on interaction.
 *
 * The architecture follows the cross-browser rules an SVG-filter lens must obey
 * (learned the hard way in prior art): the filtered element is a **single,
 * untransformed, full-surface copy** of the track. The lens is a moving
 * `clip-path` window into that copy plus a displacement map positioned at the
 * lens via a filter subregion — so the refracted track lines up exactly with the
 * real track beneath it (no doubled track), and the lens never vanishes the way a
 * `transform`-ed filtered element does in WebKit.
 *
 * Performance: the map is regenerated only when the lens SIZE changes (the brief
 * bloom), never while dragging — a drag only moves the clip window + subregion,
 * which is cheap. The tint, specular, and shadow layers are plain transformed
 * divs (transforms are safe on UNfiltered elements).
 */
export function GlassControlLens({
  material,
  boxW,
  boxH,
  behind,
  refract,
  centerX,
  centerY = 0.5,
  lensW,
  lensH,
  radius,
  stretch,
  stretchWidthFactor = -0.2,
  stretchHeightFactor = 0.4,
  stretchMin = Number.NEGATIVE_INFINITY,
  stretchMax = Number.POSITIVE_INFINITY,
  tintOpacity,
  tintColor = '#ffffff',
  restContent,
  shadowOpacity,
  restShadowOpacity,
  edgeShadow,
  restEdgeShadow,
}: GlassControlLensProps) {
  // Map margin: enough real content around the lens that the rim refraction and
  // chroma fringe always sample pixels, never the edge.
  const margin = Math.ceil(material.scale * (1 + material.chroma) + material.depth + 6)
  const baseScale = material.scale * 2
  const chroma = material.chroma

  const baseId = `ogc-${useId().replace(/:/g, '')}`

  const containerRef = useRef<HTMLDivElement>(null)
  const refractionRef = useRef<HTMLDivElement>(null)
  const copyRef = useRef<HTMLDivElement>(null)
  const filterRef = useRef<SVGFilterElement>(null)
  const mapImgRef = useRef<SVGFEImageElement>(null)
  const tintRef = useRef<HTMLDivElement>(null)
  const restContentRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const restShadowRef = useRef<HTMLDivElement>(null)
  // Monotonic across effect re-runs so WebKit never re-sees a stale filter id.
  const versionRef = useRef(0)

  // The shared overlay carries a big drop shadow meant for large panes; on a
  // small control the dedicated shadow layers own that, so keep only the rim.
  const overlayStyle = useMemo(() => {
    const eh = material.edgeHighlight
    return {
      ...openGlassOverlayStyle(material),
      boxShadow: `inset 0 1px 1px rgba(255,255,255,${eh}), inset 0 0 0 1px rgba(255,255,255,${eh * 0.4})`,
    }
  }, [material])

  useLayoutEffect(() => {
    const refraction = refractionRef.current
    const mapImg = mapImgRef.current
    const filter = filterRef.current
    if (!refraction || !mapImg || !filter) return

    // Own the filter id + the element's `filter` style IMPERATIVELY (they're not
    // in the JSX). If React controlled them, a re-render (e.g. a controlled
    // `checked` flip) would reset the id back to a previously-used value — and
    // WebKit, which caches filter output by id, would then serve the STALE
    // (empty) layer, so the control would stop refracting. Keeping them out of
    // React's hands lets us rotate the id freely.
    const applyFilter = (id: string) => {
      filter.id = id
      const url = `url(#${id})`
      refraction.style.filter = url
      refraction.style.setProperty('-webkit-filter', url)
    }
    applyFilter(baseId)

    // Cache the generated map so we only rebuild it when the lens SIZE changes.
    let lastMapW = -1
    let lastMapH = -1
    let lastMapR = -1

    const ensureMap = (w: number, h: number, r: number) => {
      if (Math.abs(w - lastMapW) < 0.75 && Math.abs(h - lastMapH) < 0.75 && Math.abs(r - lastMapR) < 0.75) {
        return
      }
      lastMapW = w
      lastMapH = h
      lastMapR = r
      const url = makeOpenGlassDisplacementMap(
        { ...material, width: w, height: h, borderRadius: r },
        margin,
      )
      mapImg.setAttribute('href', url)
    }

    let lastSig = ''

    const write = () => {
      const rawStretch = stretch ? stretch.get() : 0
      const st = Math.max(stretchMin, Math.min(stretchMax, rawStretch))
      // The MAP is keyed off the unstretched (base) size so the brief
      // squash-stretch wobble never regenerates it — regen only happens during
      // the bloom. (Per-frame regen thrashes feImage: shimmer in Blink, a dead
      // filter in WebKit.) Stretch is applied to the cheap clip/subregion geom.
      const baseW = Math.max(1, lensW.get())
      const baseH = Math.max(1, lensH.get())
      const baseR = Math.max(0, Math.min(radius.get(), Math.min(baseW, baseH) / 2))
      ensureMap(baseW, baseH, baseR)

      const lw = Math.max(1, baseW * (1 + stretchWidthFactor * st))
      const lh = Math.max(1, baseH * (1 + stretchHeightFactor * st))
      const r = Math.max(0, Math.min(baseR, Math.min(lw, lh) / 2))
      const cx = centerX.get() * boxW
      const cy = centerY * boxH
      const left = cx - lw / 2
      const top = cy - lh / 2

      // Position the displacement-map subregion at the lens (origin pinned at 0,0
      // — WebKit freezes an offset userSpaceOnUse region's content).
      const mapW = lw + margin * 2
      const mapH = lh + margin * 2
      mapImg.setAttribute('x', String(left - margin))
      mapImg.setAttribute('y', String(top - margin))
      mapImg.setAttribute('width', String(mapW))
      mapImg.setAttribute('height', String(mapH))

      const sig = `${left}|${top}|${lw}|${lh}|${r}`
      const changed = sig !== lastSig
      lastSig = sig

      // Clip the full-surface copy to the lens silhouette.
      refraction.style.clipPath = `inset(${Math.max(0, top)}px ${Math.max(0, boxW - (left + lw))}px ${Math.max(0, boxH - (top + lh))}px ${Math.max(0, left)}px round ${r}px)`

      // WebKit caches filter output by id; whenever the lens moves, grows, or the
      // map subregion shifts, rotate the id so the cached layer re-runs. Chromium
      // re-runs on its own, so keep its id stable.
      if (IS_WEBKIT && changed) {
        versionRef.current += 1
        applyFilter(`${baseId}-v${versionRef.current}`)
      }

      // Unfiltered layers — transforms are safe here (not the filtered element).
      const place = (el: HTMLDivElement | null) => {
        if (!el) return
        el.style.transform = `translate3d(${left}px, ${top}px, 0)`
        el.style.width = `${lw}px`
        el.style.height = `${lh}px`
        el.style.borderRadius = `${r}px`
      }
      place(tintRef.current)
      place(restContentRef.current)
      place(overlayRef.current)
      place(shadowRef.current)
      place(restShadowRef.current)

      const t = tintOpacity.get()
      if (refractionRef.current) refractionRef.current.style.opacity = String(1 - t)
      if (tintRef.current) tintRef.current.style.opacity = String(t)
      if (restContentRef.current) restContentRef.current.style.opacity = String(t)
      if (overlayRef.current) overlayRef.current.style.opacity = String(1 - t)
      if (shadowRef.current) shadowRef.current.style.opacity = String(shadowOpacity.get())
      if (restShadowRef.current) restShadowRef.current.style.opacity = String(restShadowOpacity.get())
    }

    write()
    const sources = [centerX, lensW, lensH, radius, stretch, tintOpacity, shadowOpacity, restShadowOpacity]
    const detaches = sources.map((s) => s?.on('change', write))
    return () => detaches.forEach((off) => off?.())
  }, [
    material,
    margin,
    baseId,
    boxW,
    boxH,
    centerX,
    centerY,
    lensW,
    lensH,
    radius,
    stretch,
    stretchWidthFactor,
    stretchHeightFactor,
    stretchMin,
    stretchMax,
    tintOpacity,
    shadowOpacity,
    restShadowOpacity,
  ])

  return (
    <div ref={containerRef} aria-hidden style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
      <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
        <filter
          ref={filterRef}
          x="0"
          y="0"
          width={boxW}
          height={boxH}
          filterUnits="userSpaceOnUse"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodColor="rgb(128,128,128)" floodOpacity="1" result="mapBg" />
          <feImage ref={mapImgRef} preserveAspectRatio="none" result="rawMap" />
          <feComposite in="rawMap" in2="mapBg" operator="over" result="map" />
          {chroma > 0 ? (
            <>
              <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale * (1 + chroma)} xChannelSelector="R" yChannelSelector="G" result="dR" />
              <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale} xChannelSelector="R" yChannelSelector="G" result="dG" />
              <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG" />
              <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale * (1 - chroma)} xChannelSelector="R" yChannelSelector="G" result="dB" />
              <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB" />
              <feBlend in="cR" in2="cG" mode="screen" result="cRG" />
              <feBlend in="cRG" in2="cB" mode="screen" />
            </>
          ) : (
            <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale} xChannelSelector="R" yChannelSelector="G" />
          )}
        </filter>
      </svg>

      {/* Crossfading drop shadows (resting puck ⇄ expanded lens). */}
      <div ref={restShadowRef} style={{ position: 'absolute', left: 0, top: 0, boxShadow: restEdgeShadow, willChange: 'transform' }} />
      <div ref={shadowRef} style={{ position: 'absolute', left: 0, top: 0, boxShadow: edgeShadow, opacity: 0, willChange: 'transform' }} />

      {/* The full-surface refracted copy — UNTRANSFORMED, clipped to the lens.
          `filter` is applied imperatively (see the effect), never via JSX, so a
          React re-render can't reset the WebKit-rotated id. */}
      <div
        ref={refractionRef}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: boxW,
          height: boxH,
        }}
      >
        <div
          ref={copyRef}
          style={{
            position: 'absolute',
            inset: 0,
            background: behind,
            filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
          }}
        >
          {refract}
        </div>
      </div>

      {/* Solid white puck — fades out as it blooms into glass. */}
      <div ref={tintRef} style={{ position: 'absolute', left: 0, top: 0, background: tintColor, willChange: 'transform, opacity' }} />

      {restContent ? (
        <div
          ref={restContentRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            willChange: 'transform, opacity',
          }}
        >
          {restContent}
        </div>
      ) : null}

      {/* Rim + specular glare — fades in as the puck becomes glass. */}
      <div ref={overlayRef} style={{ position: 'absolute', left: 0, top: 0, opacity: 0, willChange: 'transform, opacity', ...overlayStyle }} />
    </div>
  )
}
