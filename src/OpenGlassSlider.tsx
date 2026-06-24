import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { OPEN_GLASS_DEFAULTS, type OpenGlassMaterial } from './material'
import { GlassControlLens } from './GlassControlLens'
import {
  animateGlassValue,
  cubicBezier,
  deriveGlass,
  glassValue,
  rubberBand,
  useLensWobble,
  usePrefersReducedMotion,
} from './motion'

const EASE = cubicBezier(0.34, 1.36, 0.42, 1)
const SETTLE = cubicBezier(0.36, 0, 0.18, 1)

const BLOOM = 1.45

const TINT = '#ffffff'
const REST_SHADOW = '0 1px 3px rgba(40, 12, 12, 0.2)'
const LENS_SHADOW = '0 2px 7px rgba(0, 0, 0, 0.2)'

/** Optics for the glass handle — magnifies the thin track strongly via the dome. */
const SLIDER_OPTICS: Partial<OpenGlassMaterial> = {
  scale: 11,
  depth: 7,
  curvature: 2.2,
  splay: -1,
  dome: 0.55,
  chroma: 0.12,
  glow: 0.45,
  edgeHighlight: 0.7,
  specularAngle: 325,
}

export interface OpenGlassSliderProps {
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  /** Full control width. @default 240 */
  width?: number
  /** Thumb (lens) height; the control is this tall. @default 22 */
  thumbHeight?: number
  thumbWidth?: number
  /** Visible track height. @default 6 */
  height?: number
  name?: string
  'aria-label'?: string
  /** Track colour. Must be opaque. */
  trackColor?: string
  /** Fill colour. */
  activeColor?: string
  /** Background colour the lens refracts against. Must be opaque. */
  surface?: string
  /** Optics overrides for the glass handle. */
  optics?: Partial<OpenGlassMaterial>
  /** Hold the handle bloomed open (for demos/screenshots). */
  forceExpanded?: boolean
}

/**
 * A macOS-style glass range slider. At rest the handle is a white pill; dragging
 * blooms it into an OpenGlass lens that magnifies the accent fill through it,
 * with a specular rim, squash-stretch wobble, and rubber-band overdrag. Wraps a
 * real `<input type="range">` for accessibility, controllable or uncontrolled.
 */
export function OpenGlassSlider({
  value,
  defaultValue = 50,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled,
  width: trackW = 240,
  thumbHeight: thumbH = 22,
  thumbWidth,
  height: trackH = 6,
  name,
  'aria-label': ariaLabel,
  trackColor = '#e2e2da',
  activeColor = '#2592fe',
  surface = '#fafaf6',
  optics,
  forceExpanded = false,
}: OpenGlassSliderProps) {
  const isControlled = value !== undefined
  const [internal, setInternal] = useState(defaultValue)
  const current = isControlled ? (value as number) : internal

  const reduced = usePrefersReducedMotion()
  const dur = (s: number) => (reduced ? 0 : s)
  const EXPAND_ANIM = { ease: EASE, duration: dur(0.27) }
  const COLLAPSE_ANIM = { ease: SETTLE, duration: dur(0.42) }

  const commit = useCallback(
    (raw: number) => {
      const snapped = step > 0 ? Math.round((raw - min) / step) * step + min : raw
      const clamped = Math.max(min, Math.min(max, snapped))
      if (!isControlled) setInternal(clamped)
      onValueChange?.(clamped)
    },
    [min, max, step, isControlled, onValueChange],
  )

  // Geometry.
  const thumbW = thumbWidth ?? Math.round(2 * thumbH)
  const travel = trackW - thumbW
  const trackRadius = trackH / 2
  const restRadius = thumbH / 2
  const rubberLimit = trackW * 0.05
  const rubberRange = rubberLimit * 30
  const lensWexp = BLOOM * thumbW
  const lensHexp = BLOOM * thumbH
  const margin = Math.ceil((optics?.scale ?? SLIDER_OPTICS.scale ?? 11) + (optics?.depth ?? SLIDER_OPTICS.depth ?? 7) + 6)
  const edge = Math.ceil(lensWexp / 2 - thumbW / 2 + rubberLimit) + 2
  const boxW = trackW + 2 * edge
  const boxH = thumbH + 2 * edge

  const material = useMemo<OpenGlassMaterial>(
    () => ({ ...OPEN_GLASS_DEFAULTS, ...SLIDER_OPTICS, ...optics, width: lensWexp, height: lensHexp, borderRadius: lensHexp / 2 }),
    [optics, lensWexp, lensHexp],
  )

  const valueToX = useCallback(
    (v: number) => (max > min ? ((v - min) / (max - min)) * travel : 0),
    [min, max, travel],
  )
  const xToValue = useCallback(
    (x: number) => {
      const clamped = Math.max(0, Math.min(travel, x))
      const raw = travel > 0 ? min + (clamped / travel) * (max - min) : min
      return step > 0 ? Math.round((raw - min) / step) * step + min : raw
    },
    [min, max, travel, step],
  )

  const refs = useRef({ travel, thumbW, boxW, edge, rubberLimit, rubberRange })
  useLayoutEffect(() => {
    refs.current = { travel, thumbW, boxW, edge, rubberLimit, rubberRange }
  })

  const valueToXRef = useRef(valueToX)
  const initialRef = useRef(current)
  const mv = useMemo(() => {
    const thumbX = glassValue(valueToXRef.current(initialRef.current))
    const centerX = deriveGlass(
      [thumbX],
      () => (refs.current.edge + refs.current.thumbW / 2 + thumbX.get()) / refs.current.boxW,
    )
    const lensW = glassValue(thumbW)
    const lensH = glassValue(thumbH)
    const radius = glassValue(restRadius)
    const stretch = glassValue(0)
    const tintOpacity = glassValue(1)
    const shadowOpacity = glassValue(0)
    const restShadowOpacity = deriveGlass([shadowOpacity], () => 1 - shadowOpacity.get())
    return { thumbX, centerX, lensW, lensH, radius, stretch, tintOpacity, shadowOpacity, restShadowOpacity }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const holdRef = useRef(0)
  const kickWobbleRef = useRef<() => void>(() => {})
  useLensWobble(mv.thumbX, mv.stretch, holdRef, kickWobbleRef)

  const expand = () => {
    animateGlassValue(mv.lensW, lensWexp, EXPAND_ANIM)
    animateGlassValue(mv.lensH, lensHexp, EXPAND_ANIM)
    animateGlassValue(mv.radius, lensHexp / 2, EXPAND_ANIM)
    animateGlassValue(mv.tintOpacity, 0, EXPAND_ANIM)
    animateGlassValue(mv.shadowOpacity, 1, EXPAND_ANIM)
  }
  const collapse = () => {
    animateGlassValue(mv.lensW, thumbW, COLLAPSE_ANIM)
    animateGlassValue(mv.lensH, thumbH, COLLAPSE_ANIM)
    animateGlassValue(mv.radius, restRadius, COLLAPSE_ANIM)
    animateGlassValue(mv.tintOpacity, 1, COLLAPSE_ANIM)
    animateGlassValue(mv.shadowOpacity, 0, COLLAPSE_ANIM)
  }

  // Init to `false` so mounting with forceExpanded=true reads as a change and
  // fires the bloom rather than starting silently expanded.
  const forceExpandedRef = useRef(false)
  useEffect(() => {
    if (forceExpanded === forceExpandedRef.current) return
    forceExpandedRef.current = forceExpanded
    if (forceExpanded) {
      expand()
      holdRef.current = 0.175
      kickWobbleRef.current()
    } else {
      collapse()
      holdRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExpanded])

  const wrapperRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const draggingRef = useRef(false)
  const pointerIdRef = useRef<number | null>(null)
  const startClientXRef = useRef(0)
  const startThumbXRef = useRef(0)

  const releaseCapture = () => {
    const id = pointerIdRef.current
    pointerIdRef.current = null
    if (id !== null && rootRef.current) {
      try {
        if (rootRef.current.hasPointerCapture(id)) rootRef.current.releasePointerCapture(id)
      } catch {
        // already released
      }
    }
  }

  // Follow the value when not dragging.
  useEffect(() => {
    if (!draggingRef.current) mv.thumbX.set(valueToX(current))
  }, [current, valueToX, mv.thumbX])

  // Drive the fill + progress crossfade imperatively.
  useLayoutEffect(() => {
    const apply = (x: number) => {
      const el = wrapperRef.current
      if (!el) return
      const fill = refs.current.thumbW / 2 + x
      const progress = refs.current.travel > 0 ? x / refs.current.travel : 0
      el.style.setProperty('--og-slider-fill', `${fill}px`)
      el.style.setProperty('--og-slider-progress', String(Math.max(0, Math.min(1, progress))))
    }
    apply(mv.thumbX.get())
    return mv.thumbX.on('change', apply)
  }, [mv.thumbX])

  const endDrag = (e: React.PointerEvent) => {
    if (e.pointerId !== pointerIdRef.current) return
    releaseCapture()
    draggingRef.current = false
    holdRef.current = 0
    const settled = Math.max(0, Math.min(refs.current.travel, mv.thumbX.get()))
    animateGlassValue(mv.thumbX, settled, COLLAPSE_ANIM)
    collapse()
  }

  // A copy of the whole control surface — the thin track + fill at its natural
  // position, so the magnified refraction lines up with the real track.
  const trackCopy = (
    <div style={{ position: 'absolute', left: edge, top: boxH / 2 - trackH / 2, width: trackW, height: trackH, borderRadius: trackRadius, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'var(--og-track)' }} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--og-active)',
          transform: 'translateX(calc((var(--og-slider-progress, 0) - 1) * 100%))',
        }}
      />
    </div>
  )

  return (
    <div
      ref={wrapperRef}
      style={
        {
          flexShrink: 0,
          width: trackW,
          height: thumbH,
          overflow: 'visible',
          borderRadius: 999,
          position: 'relative',
          opacity: disabled ? 0.4 : undefined,
          cursor: disabled ? 'not-allowed' : undefined,
          '--og-track': trackColor,
          '--og-active': activeColor,
        } as CSSProperties
      }
    >
      <input
        ref={inputRef}
        type="range"
        min={min}
        max={max}
        step={step}
        value={current}
        disabled={disabled}
        name={name}
        aria-label={ariaLabel}
        onChange={(e) => commit(Number(e.target.value))}
        style={visuallyHidden}
      />

      {/* Interactive track (under the lens — the lens covers it in the window). */}
      <div
        ref={rootRef}
        aria-hidden
        style={{
          width: trackW,
          height: thumbH,
          cursor: disabled ? 'not-allowed' : 'pointer',
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
        }}
        onPointerDown={(e) => {
          if (disabled || pointerIdRef.current !== null) return
          pointerIdRef.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          draggingRef.current = true
          inputRef.current?.focus({ preventScroll: true })
          const rect = rootRef.current?.getBoundingClientRect()
          const raw = rect ? e.clientX - rect.left - refs.current.thumbW / 2 : 0
          const x = Math.max(0, Math.min(refs.current.travel, raw))
          mv.thumbX.set(x)
          commit(xToValue(x))
          startClientXRef.current = e.clientX
          startThumbXRef.current = x
          expand()
          holdRef.current = 0.175
          kickWobbleRef.current()
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== pointerIdRef.current) return
          let x = startThumbXRef.current + (e.clientX - startClientXRef.current)
          const { travel: t, rubberLimit: rl, rubberRange: rr } = refs.current
          if (x < 0) x = -rubberBand(-x, rl, rr)
          else if (x > t) x = t + rubberBand(x - t, rl, rr)
          mv.thumbX.set(x)
          commit(xToValue(Math.max(0, Math.min(t, x))))
        }}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onDragStart={(e) => e.preventDefault()}
      >
        {/* Visible track + fill. */}
        <div style={{ width: '100%', position: 'relative', overflow: 'hidden', height: trackH, borderRadius: trackRadius }}>
          <div style={{ position: 'absolute', inset: 0, background: 'var(--og-track)', borderRadius: 'inherit' }} />
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              width: 'var(--og-slider-fill)',
              background: 'var(--og-active)',
              borderRadius: trackRadius,
            }}
          />
        </div>
      </div>

      {/* Lens layer — on top of the track so the refraction covers it. */}
      <div style={{ position: 'absolute', left: -edge, top: -edge, width: boxW, height: boxH, pointerEvents: 'none' }}>
        <GlassControlLens
          material={material}
          boxW={boxW}
          boxH={boxH}
          behind={surface}
          refract={trackCopy}
          centerX={mv.centerX}
          lensW={mv.lensW}
          lensH={mv.lensH}
          radius={mv.radius}
          stretch={mv.stretch}
          tintOpacity={mv.tintOpacity}
          tintColor={TINT}
          shadowOpacity={mv.shadowOpacity}
          restShadowOpacity={mv.restShadowOpacity}
          edgeShadow={LENS_SHADOW}
          restEdgeShadow={REST_SHADOW}
        />
      </div>
    </div>
  )
}

const visuallyHidden: CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  margin: -1,
  border: 0,
  padding: 0,
  overflow: 'hidden',
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}
