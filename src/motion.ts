import { useEffect, useRef, useState, type MutableRefObject } from 'react'

// ---------------------------------------------------------------------------
// Motion primitives for interactive glass controls.
//
// A tiny reactive scalar ("motion value") plus the easing, tweening, and
// gesture helpers built on it. They let a control animate the lens at 60fps
// imperatively — no React re-render per frame — which is what keeps the
// refraction smooth (and cheap on WebKit). None are needed to use the static
// glass; they exist for building things like the switch and slider.
// ---------------------------------------------------------------------------

export interface GlassMotionValue {
  get(): number
  set(value: number): void
  /** Subscribe to changes; returns an unsubscribe function. */
  on(event: 'change', callback: (value: number) => void): () => void
}

export type GlassValue = number | GlassMotionValue

export function isGlassMotionValue(value: unknown): value is GlassMotionValue {
  return typeof value === 'object' && value !== null && 'get' in value && 'on' in value
}

export function readGlassValue(value: GlassValue): number {
  return isGlassMotionValue(value) ? value.get() : value
}

class Signal implements GlassMotionValue {
  private current: number
  private readonly subscribers = new Set<(value: number) => void>()

  constructor(initial: number) {
    this.current = initial
  }

  get(): number {
    return this.current
  }

  set(next: number): void {
    if (next === this.current) return
    this.current = next
    // Iterate a snapshot so a subscriber detaching mid-notify is safe.
    for (const notify of Array.from(this.subscribers)) notify(next)
  }

  on(_event: 'change', callback: (value: number) => void): () => void {
    this.subscribers.add(callback)
    return () => this.subscribers.delete(callback)
  }
}

/** A reactive scalar seeded with `initial`. */
export function glassValue(initial: number): GlassMotionValue {
  return new Signal(initial)
}

/** A motion value computed from others; recomputes whenever an input changes. */
export function deriveGlass(deps: GlassMotionValue[], compute: () => number): GlassMotionValue {
  const out = glassValue(compute())
  const recompute = () => out.set(compute())
  for (const dep of deps) dep.on('change', recompute)
  return out
}

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/**
 * Cubic-bezier easing matching CSS `cubic-bezier()`. Newton–Raphson to invert
 * x→t with a bisection fallback; y control points outside [0,1] give overshoot.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solve = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i += 1) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-6) return t
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= error / slope
    }
    let lo = 0
    let hi = 1
    t = x
    while (lo < hi) {
      const sampled = sampleX(t)
      if (Math.abs(sampled - x) < 1e-6) break
      if (sampled < x) lo = t
      else hi = t
      if (hi - lo < 1e-7) break
      t = (lo + hi) / 2
    }
    return t
  }

  return (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)))
}

/** Default control easing — a gentle overshoot on settle. */
export const glassEase = cubicBezier(0.34, 1.36, 0.42, 1)

export interface GlassAnimation {
  stop(): void
}

export interface GlassAnimationOptions {
  /** Seconds. @default 0.3 */
  duration?: number
  ease?: (t: number) => number
  onComplete?: () => void
}

// One in-flight tween per value; retargeting cancels the previous cleanly.
const inFlight = new WeakMap<GlassMotionValue, GlassAnimation>()

/** Tween a motion value to `to`, cancelling any tween already running on it. */
export function animateGlassValue(
  value: GlassMotionValue,
  to: number,
  { duration = 0.3, ease = glassEase, onComplete }: GlassAnimationOptions = {},
): GlassAnimation {
  inFlight.get(value)?.stop()
  const from = value.get()
  if (from === to || duration <= 0) {
    value.set(to)
    onComplete?.()
    return { stop() {} }
  }

  const durationMs = duration * 1000
  let frame = 0
  let startedAt = 0

  const advance = (now: number) => {
    if (startedAt === 0) startedAt = now
    const progress = (now - startedAt) / durationMs
    if (progress >= 1) {
      value.set(to)
      inFlight.delete(value)
      onComplete?.()
      return
    }
    value.set(from + (to - from) * ease(progress))
    frame = requestAnimationFrame(advance)
  }
  frame = requestAnimationFrame(advance)

  const handle: GlassAnimation = {
    stop() {
      cancelAnimationFrame(frame)
      inFlight.delete(value)
    },
  }
  inFlight.set(value, handle)
  return handle
}

/** Cubic ease-out of drag past an end (1−(1−t)³), capped at `limit`. */
export function rubberBand(excess: number, limit: number, range: number): number {
  const t = excess < range ? excess / range : 1
  return limit * t * (3 + t * (t - 3))
}

// Squash-stretch spring tuning. The stretch target rises sub-linearly with
// pointer speed (so flicks don't blow out) and is held while pressed; an
// underdamped spring chases it for a little bounce on release.
const SPRING_STIFFNESS = 176
const SPRING_DAMPING = 13.6
const STRETCH_CEILING = 0.34
const SPEED_SHAPE = 0.75
const SPEED_DIVISOR = 84
const MAX_STEP = 0.033
const VEL_DT_MIN = 0.008
const VEL_DT_MAX = 0.03

/**
 * Velocity-driven squash-and-stretch. Watches a position value, derives its
 * speed, and runs an underdamped spring on `stretch`. While `holdRef.current`
 * is > 0 (press-and-hold) it stays stretched. Call `kickRef.current()` to start
 * the loop on press.
 */
export function useLensWobble(
  position: GlassMotionValue,
  stretch: GlassMotionValue,
  holdRef: MutableRefObject<number>,
  kickRef: MutableRefObject<() => void>,
): void {
  useEffect(() => {
    let frame = 0
    let displacement = 0
    let velocity = 0
    let prevStamp = 0
    let prevPosition = position.get()
    let active = false

    const target = (speed: number) => {
      const fromSpeed = Math.pow(speed, SPEED_SHAPE) / SPEED_DIVISOR
      const responsive = Math.min(fromSpeed, STRETCH_CEILING)
      return Math.min(Math.max(responsive, holdRef.current), STRETCH_CEILING)
    }

    const settled = (speed: number) =>
      Math.abs(displacement) < 6e-4 &&
      Math.abs(velocity) < 6e-3 &&
      speed < 6e-3 &&
      holdRef.current === 0

    const step = (now: number) => {
      const gap = (now - prevStamp) / 1000
      const dt = Math.min(gap, MAX_STEP)
      prevStamp = now

      const pos = position.get()
      const velDt = Math.min(Math.max(gap, VEL_DT_MIN), VEL_DT_MAX)
      const speed = Math.abs((pos - prevPosition) / velDt)
      prevPosition = pos

      const accel = SPRING_STIFFNESS * (target(speed) - displacement) - SPRING_DAMPING * velocity
      velocity += accel * dt
      displacement += velocity * dt
      stretch.set(displacement)

      if (settled(speed)) {
        active = false
        stretch.set(0)
        return
      }
      frame = requestAnimationFrame(step)
    }

    const begin = () => {
      if (active) return
      active = true
      prevStamp = performance.now()
      prevPosition = position.get()
      frame = requestAnimationFrame(step)
    }

    kickRef.current = begin
    const detach = position.on('change', begin)
    return () => {
      detach()
      cancelAnimationFrame(frame)
      kickRef.current = () => {}
    }
  }, [position, stretch, holdRef, kickRef])
}

/** `true` when the user asks for reduced motion. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}
