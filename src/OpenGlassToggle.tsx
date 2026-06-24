import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react'
import { OPEN_GLASS_DEFAULTS, type OpenGlassMaterial } from './material'
import { GlassControlLens } from './GlassControlLens'
import { GlassDiv } from './GlassDiv'
import {
  animateGlassValue,
  cubicBezier,
  deriveGlass,
  glassValue,
  rubberBand,
  useLensWobble,
  usePrefersReducedMotion,
  type GlassAnimation,
} from './motion'

// Motion signature: an overshoot curve for grow/toggle, a clean ease-out for the
// collapse — matching the macOS switch feel.
const EASE = cubicBezier(0.34, 1.36, 0.42, 1)
const SETTLE = cubicBezier(0.36, 0, 0.18, 1)

// The lens blooms to BLOOM× the resting puck (it floats above the track, so
// growing past the track height is intended).
const BLOOM = 1.5

const TINT = '#ffffff'
const REST_SHADOW = '0 1px 2px rgba(0, 0, 0, 0.28), 0 3px 8px rgba(0, 0, 0, 0.16)'
const LENS_SHADOW = '0 2px 7px rgba(0, 0, 0, 0.2)'

/**
 * Optics for the glass thumb. Unlike the slider (which leans on a strong body
 * `dome` to magnify the thin track), a switch thumb should read as a thin pane
 * of glass: almost no body magnification, but a deep refractive rim with chroma
 * so the track edge bends and fringes through it. `dome` near zero keeps the
 * centre ~1:1; `scale`/`depth`/`curvature` shape the rim distortion.
 */
const TOGGLE_OPTICS: Partial<OpenGlassMaterial> = {
  scale: 8,
  depth: 9,
  curvature: 2.6,
  splay: -1,
  dome: 0.06,
  chroma: 0.18,
  glow: 0.45,
  edgeHighlight: 0.7,
  specularAngle: 325,
}

export interface OpenGlassToggleProps {
  checked?: boolean
  defaultChecked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  name?: string
  value?: string
  'aria-label'?: string
  /** Full control width. @default 74 */
  width?: number
  /** Full control height. @default 28 */
  height?: number
  /** Track colour at rest. Must be opaque. */
  trackColor?: string
  /** Track colour when on. */
  activeColor?: string
  /** Background colour the lens refracts against. Must be opaque. */
  surface?: string
  /** Optics overrides for the glass thumb. */
  optics?: Partial<OpenGlassMaterial>
  /** Hold the thumb bloomed open (for demos/screenshots). */
  forceExpanded?: boolean
}

/**
 * A macOS-style glass switch. At rest the thumb is a clean white puck on a
 * grey/accent track; pressing or dragging blooms it into an OpenGlass lens that
 * refracts the track through it, with a specular rim, a velocity squash-stretch
 * wobble, and a rubber-band overdrag. Wraps a real `role="switch"` checkbox for
 * accessibility, and is controllable or uncontrolled.
 */
export function OpenGlassToggle({
  checked,
  defaultChecked = false,
  onCheckedChange,
  disabled,
  name,
  value,
  'aria-label': ariaLabel,
  width: S = 74,
  height: R = 28,
  trackColor = '#e2e2da',
  activeColor = '#2592fe',
  surface = '#fafaf6',
  optics,
  forceExpanded = false,
}: OpenGlassToggleProps) {
  const isControlled = checked !== undefined
  const [internal, setInternal] = useState(defaultChecked)
  const on = isControlled ? (checked as boolean) : internal

  const reduced = usePrefersReducedMotion()
  const dur = (s: number) => (reduced ? 0 : s)
  const THUMB_ANIM = { ease: EASE, duration: dur(0.5) }
  const EXPAND_ANIM = { ease: EASE, duration: dur(0.26) }
  const COLLAPSE_ANIM = { ease: SETTLE, duration: dur(0.42) }

  // Geometry — a wide pill thumb (not a circle) that floats above the track.
  const thumbW = Math.round(0.6 * S)
  const thumbH = R - 6
  const travel = S - thumbW - 6
  const rubberLimit = S * 0.14
  const rubberRange = rubberLimit * 10
  const restRadius = thumbH / 2
  // The refracted track copy is deliberately shorter than the real track so the
  // bloomed lens (which is taller than this) has surface margin above/below to
  // bend the pill edge through — that curved edge is what reads as refraction.
  // A full-height copy fills the lens with flat colour and looks like nothing.
  const refractionTrackH = Math.round(0.75 * R)
  const lensWexp = BLOOM * thumbW
  const lensHexp = BLOOM * thumbH
  const margin = Math.ceil((optics?.scale ?? TOGGLE_OPTICS.scale ?? 6) + (optics?.depth ?? TOGGLE_OPTICS.depth ?? 8) + 6)
  // Room in the box for the bloomed lens + rubber overdrag past the track ends.
  const edge = Math.ceil(lensWexp / 2 - thumbW / 2 + rubberLimit) + 2
  const boxW = S + 2 * edge
  const boxH = R + 2 * edge

  const material = useMemo<OpenGlassMaterial>(
    () => ({ ...OPEN_GLASS_DEFAULTS, ...TOGGLE_OPTICS, ...optics, width: lensWexp, height: lensHexp, borderRadius: lensHexp / 2 }),
    [optics, lensWexp, lensHexp],
  )

  // Live geometry mirrored into refs so the once-created motion callbacks read
  // fresh values without re-subscribing.
  const refs = useRef({ travel, thumbW, boxW, edge })
  useLayoutEffect(() => {
    refs.current = { travel, thumbW, boxW, edge }
  })

  const mv = useMemo(() => {
    const thumbX = glassValue(on ? travel : 0)
    const centerX = deriveGlass(
      [thumbX],
      () => (refs.current.edge + 3 + refs.current.thumbW / 2 + thumbX.get()) / refs.current.boxW,
    )
    const lensW = glassValue(thumbW)
    const lensH = glassValue(thumbH)
    const radius = glassValue(restRadius)
    const stretch = glassValue(0)
    const tintOpacity = glassValue(1)
    const shadowOpacity = glassValue(0)
    const restShadowOpacity = deriveGlass([shadowOpacity], () => 1 - shadowOpacity.get())
    const trackScaleX = glassValue(0.85)
    const trackScaleY = glassValue(0.525)
    return { thumbX, centerX, lensW, lensH, radius, stretch, tintOpacity, shadowOpacity, restShadowOpacity, trackScaleX, trackScaleY }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const holdRef = useRef(0)
  const kickWobbleRef = useRef<() => void>(() => {})
  useLensWobble(mv.thumbX, mv.stretch, holdRef, kickWobbleRef)

  const expand = (anim: typeof EXPAND_ANIM) => {
    animateGlassValue(mv.lensW, lensWexp, anim)
    animateGlassValue(mv.lensH, lensHexp, anim)
    animateGlassValue(mv.radius, lensHexp / 2, anim)
    animateGlassValue(mv.tintOpacity, 0, anim)
    animateGlassValue(mv.shadowOpacity, 1, anim)
    animateGlassValue(mv.trackScaleX, 0.95, anim)
    animateGlassValue(mv.trackScaleY, 0.975, anim)
  }
  const collapse = (anim: typeof COLLAPSE_ANIM) => {
    animateGlassValue(mv.lensW, thumbW, anim)
    animateGlassValue(mv.lensH, thumbH, anim)
    animateGlassValue(mv.radius, restRadius, anim)
    animateGlassValue(mv.tintOpacity, 1, anim)
    animateGlassValue(mv.shadowOpacity, 0, anim)
    animateGlassValue(mv.trackScaleX, 0.85, anim)
    animateGlassValue(mv.trackScaleY, 0.525, anim)
  }

  // Init to `false` so mounting with forceExpanded=true reads as a change and
  // fires the bloom rather than starting silently expanded.
  const forceExpandedRef = useRef(false)
  useEffect(() => {
    if (forceExpanded === forceExpandedRef.current) return
    forceExpandedRef.current = forceExpanded
    if (forceExpanded) {
      expand(EXPAND_ANIM)
      holdRef.current = 0.175
      kickWobbleRef.current()
    } else {
      collapse(COLLAPSE_ANIM)
      holdRef.current = 0
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceExpanded])

  // Tap-vs-drag state machine: a press is a tap if released quickly, or a
  // hold/drag past the hold timeout. All gesture state lives in refs so a drag
  // never triggers a React re-render (which would drop the pointer capture).
  const stateRef = useRef<'idle' | 'pending' | 'hold' | 'tap'>('idle')
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const mountedRef = useRef(true)
  const draggingRef = useRef(false)
  const suppressRef = useRef(false)
  const wrapperRef = useRef<HTMLLabelElement>(null)
  const hitRef = useRef<HTMLDivElement>(null)
  const pointerIdRef = useRef<number | null>(null)
  const startClientXRef = useRef(0)
  const startThumbXRef = useRef(0)
  const movedRef = useRef(false)
  const thumbAnimRef = useRef<GlassAnimation | null>(null)

  const releaseCapture = () => {
    const id = pointerIdRef.current
    pointerIdRef.current = null
    if (id !== null && hitRef.current) {
      try {
        if (hitRef.current.hasPointerCapture(id)) hitRef.current.releasePointerCapture(id)
      } catch {
        // already released
      }
    }
  }

  useEffect(
    () => () => {
      mountedRef.current = false
      clearTimeout(holdTimeoutRef.current)
      clearTimeout(collapseTimeoutRef.current)
    },
    [],
  )

  // Settle the thumb to its value when not actively interacting (e.g. controlled
  // change, keyboard). draggingRef gating keeps a drag from being interrupted.
  useEffect(() => {
    if (draggingRef.current || stateRef.current === 'tap') return
    thumbAnimRef.current = animateGlassValue(mv.thumbX, on ? travel : 0, THUMB_ANIM)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, travel])

  // Drive the track colour crossfade imperatively (a re-render would clobber the
  // animated value mid-transition).
  useLayoutEffect(() => {
    const apply = (x: number) => {
      const t = refs.current.travel
      wrapperRef.current?.style.setProperty('--og-switch-progress', String(t > 0 ? Math.max(0, Math.min(1, x / t)) : 0))
    }
    apply(mv.thumbX.get())
    return mv.thumbX.on('change', apply)
  }, [mv.thumbX])

  const commit = (next: boolean) => {
    if (!isControlled) setInternal(next)
    onCheckedChange?.(next)
  }

  const handleChange = (next: boolean) => {
    if (suppressRef.current) return
    commit(next)
    if (stateRef.current === 'idle') {
      stateRef.current = 'tap'
      expand(EXPAND_ANIM)
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = setTimeout(() => collapse(COLLAPSE_ANIM), 290)
      thumbAnimRef.current = animateGlassValue(mv.thumbX, next ? travel : 0, {
        ...THUMB_ANIM,
        onComplete: () => {
          if (mountedRef.current && stateRef.current === 'tap') stateRef.current = 'idle'
        },
      })
    }
  }

  const trackBg =
    'color-mix(in srgb, var(--og-track), var(--og-active) calc(var(--og-switch-progress, 0) * 100%))'

  // A copy of the whole control surface, painted at its natural position so the
  // refracted track lines up exactly with the real one beneath the lens.
  const trackCopy = (
    <div style={{ position: 'absolute', left: edge, top: edge, width: S, height: R, display: 'flex', alignItems: 'center' }}>
      <GlassDiv
        scaleX={mv.trackScaleX}
        scaleY={mv.trackScaleY}
        style={{ width: S, height: refractionTrackH, borderRadius: refractionTrackH / 2, background: trackBg }}
      />
    </div>
  )

  return (
    <label
      ref={wrapperRef}
      style={
        {
          flexShrink: 0,
          width: S,
          height: R,
          overflow: 'visible',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.4 : undefined,
          borderRadius: 999,
          display: 'inline-block',
          position: 'relative',
          '--og-track': trackColor,
          '--og-active': activeColor,
        } as CSSProperties
      }
    >
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onChange={(e) => handleChange(e.target.checked)}
        onClick={(e) => {
          if (suppressRef.current) e.preventDefault()
        }}
        disabled={disabled}
        name={name}
        value={value}
        aria-label={ariaLabel}
        style={visuallyHidden}
      />

      {/* Visible track. */}
      <div aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: R / 2, background: trackBg }} />

      {/* Lens layer — overflows the track for the bloom + overdrag. */}
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

      {/* Drag target — invisible, rides the thumb. */}
      <GlassDiv
        ref={hitRef}
        x={mv.thumbX}
        style={{
          position: 'absolute',
          left: 3,
          top: 3,
          width: thumbW,
          height: thumbH,
          touchAction: 'none',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          cursor: disabled ? 'not-allowed' : 'grab',
        }}
        onPointerDown={(e) => {
          if (pointerIdRef.current !== null || disabled) return
          pointerIdRef.current = e.pointerId
          e.currentTarget.setPointerCapture(e.pointerId)
          startClientXRef.current = e.clientX
          startThumbXRef.current = mv.thumbX.get()
          movedRef.current = false
          draggingRef.current = true
          suppressRef.current = true
          clearTimeout(holdTimeoutRef.current)
          clearTimeout(collapseTimeoutRef.current)
          stateRef.current = 'pending'
          holdTimeoutRef.current = setTimeout(() => {
            if (stateRef.current === 'pending') {
              stateRef.current = 'hold'
              thumbAnimRef.current?.stop()
              expand(EXPAND_ANIM)
              holdRef.current = 0.175
              kickWobbleRef.current()
            }
          }, 170)
        }}
        onPointerMove={(e) => {
          if (e.pointerId !== pointerIdRef.current) return
          const delta = e.clientX - startClientXRef.current
          if (!movedRef.current) {
            if (Math.abs(delta) < 3) return
            movedRef.current = true
            thumbAnimRef.current?.stop()
            startThumbXRef.current = mv.thumbX.get()
            startClientXRef.current = e.clientX
            clearTimeout(holdTimeoutRef.current)
            holdRef.current = 0
            if (stateRef.current !== 'hold') {
              stateRef.current = 'hold'
              expand(EXPAND_ANIM)
            }
          }
          let next = startThumbXRef.current + (e.clientX - startClientXRef.current)
          if (next < 0) next = -rubberBand(-next, rubberLimit, rubberRange)
          else if (next > travel) next = travel + rubberBand(next - travel, rubberLimit, rubberRange)
          mv.thumbX.set(next)
        }}
        onPointerUp={(e) => {
          if (e.pointerId !== pointerIdRef.current) return
          releaseCapture()
          clearTimeout(holdTimeoutRef.current)
          draggingRef.current = false
          if (movedRef.current) {
            stateRef.current = 'idle'
            collapse(COLLAPSE_ANIM)
            const next = Math.max(0, Math.min(travel, mv.thumbX.get())) > travel / 2
            thumbAnimRef.current = animateGlassValue(mv.thumbX, next ? travel : 0, THUMB_ANIM)
            if (next !== on) commit(next)
            requestAnimationFrame(() => (suppressRef.current = false))
          } else if (stateRef.current === 'pending' || stateRef.current === 'tap') {
            stateRef.current = 'tap'
            suppressRef.current = false
            expand(EXPAND_ANIM)
            clearTimeout(collapseTimeoutRef.current)
            collapseTimeoutRef.current = setTimeout(() => collapse(COLLAPSE_ANIM), 290)
            // The click bubbles to the label and toggles the input.
            const target = on ? 0 : travel
            thumbAnimRef.current = animateGlassValue(mv.thumbX, target, {
              ...THUMB_ANIM,
              onComplete: () => {
                if (mountedRef.current && stateRef.current === 'tap') stateRef.current = 'idle'
              },
            })
          } else if (stateRef.current === 'hold') {
            stateRef.current = 'idle'
            holdRef.current = 0
            collapse(COLLAPSE_ANIM)
            thumbAnimRef.current = animateGlassValue(mv.thumbX, on ? travel : 0, THUMB_ANIM)
            requestAnimationFrame(() => (suppressRef.current = false))
          } else {
            suppressRef.current = false
          }
        }}
        onPointerCancel={(e) => {
          if (e.pointerId !== pointerIdRef.current) return
          releaseCapture()
          clearTimeout(holdTimeoutRef.current)
          holdRef.current = 0
          draggingRef.current = false
          stateRef.current = 'idle'
          collapse(COLLAPSE_ANIM)
          thumbAnimRef.current = animateGlassValue(mv.thumbX, on ? travel : 0, THUMB_ANIM)
          requestAnimationFrame(() => (suppressRef.current = false))
        }}
        onDragStart={(e) => e.preventDefault()}
      />
    </label>
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
