import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { createPortal } from 'react-dom'
import {
  animateGlassValue,
  glassEase,
  glassValue,
  isWebKitEngine,
  makeOpenGlassShapeMap,
  usePrefersReducedMotion,
  type OpenGlassMaterial,
} from 'openglass'
import { drawMarkSilhouette, GlassMarkOutline, glassMarkMaskStyle, glassMarkShadowStyle } from './NaturalDesignLogo'
import { PageBackdropClone, pageBackdropColor, pageBackdropIsWebKit } from './PageBackdropClone'
import { RefractingLens } from './RefractingLens'

const IS_WEBKIT = isWebKitEngine()
const MARK_ASPECT = 89 / 70
// Must exceed the max rim displacement (scale × 2 × (1 + chroma) ≈ 43px) so the
// bevel always samples real content. Too small and edges touching the box rim —
// like the top hexagon's apex — pull in empty pixels and render as opaque white.
const MARGIN = 56
const DRIFT_DELAY_MS = 3200
const DRIFT_DURATION_S = 1.35
const LENS_Z = 30

const MARK_MATERIAL: Omit<OpenGlassMaterial, 'width' | 'height'> = {
  borderRadius: 0,
  scale: 20,
  depth: 13,
  curvature: 2.2,
  splay: -1,
  dome: 0,
  chroma: 0.08,
  blur: 0,
  glow: 0.26,
  edgeHighlight: 0.2,
  specularAngle: 325,
}

const VARIANT = {
  hero: { fill: 0.64 },
  close: { fill: 0.66 },
} as const

function markMaterial(width: number): OpenGlassMaterial {
  const w = Math.round(width)
  return { ...MARK_MATERIAL, width: w, height: Math.round(w * MARK_ASPECT) }
}

export interface DriftingGlassMarkProps {
  variant?: keyof typeof VARIANT
  style?: CSSProperties
  className?: string
}

/** Natural Design mark in OpenGlass — portaled, draggable, refracts the live page. */
export function DriftingGlassMark({ variant = 'close', style, className }: DriftingGlassMarkProps) {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState({ w: 0, h: 0 })
  const [scroll, setScroll] = useState({ x: 0, y: 0 })
  const [home, setHome] = useState({ x: 0, y: 0 })
  const [markWidth, setMarkWidth] = useState(0)
  const [epoch, setEpoch] = useState(0)
  const [, render] = useState(0)
  const offsetX = useRef(glassValue(0))
  const offsetY = useRef(glassValue(0))
  const driftTimer = useRef<number>()
  const driftAnim = useRef<{ stop(): void }>()
  const reducedMotion = usePrefersReducedMotion()
  const baseId = useId().replace(/:/g, '')
  const config = VARIANT[variant]
  const behind = pageBackdropColor()

  const material = useMemo(() => markMaterial(markWidth), [markWidth])

  const mapUrl = useMemo(
    () =>
      markWidth > 0
        ? makeOpenGlassShapeMap(material, MARGIN, (ctx) =>
            drawMarkSilhouette(ctx, material.width, material.height),
          )
        : '',
    [material, markWidth],
  )

  const onReclone = useCallback(() => {
    if (pageBackdropIsWebKit) setEpoch((e) => e + 1)
  }, [])

  useEffect(() => {
    const bump = () => render((n) => n + 1)
    const offX = offsetX.current.on('change', bump)
    const offY = offsetY.current.on('change', bump)
    return () => {
      offX()
      offY()
    }
  }, [])

  useEffect(() => {
    const measure = () => {
      setViewport({ w: window.innerWidth, h: window.innerHeight })
      setScroll({ x: window.scrollX, y: window.scrollY })
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const mw = Math.max(96, Math.round(Math.min(rect.width, rect.height) * config.fill))
      const mh = Math.round(mw * MARK_ASPECT)
      setMarkWidth(mw)
      setHome({
        x: rect.left + (rect.width - mw) / 2,
        y: rect.top + (rect.height - mh) / 2,
      })
    }

    measure()
    window.addEventListener('resize', measure, { passive: true })
    window.addEventListener('scroll', measure, { passive: true })
    const anchor = anchorRef.current
    const ro = anchor ? new ResizeObserver(measure) : null
    if (anchor) ro?.observe(anchor)
    return () => {
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure)
      ro?.disconnect()
    }
  }, [config.fill])

  useEffect(
    () => () => {
      window.clearTimeout(driftTimer.current)
      driftAnim.current?.stop()
    },
    [],
  )

  const scheduleDriftHome = () => {
    window.clearTimeout(driftTimer.current)
    driftTimer.current = window.setTimeout(
      () => {
        driftAnim.current?.stop()
        const duration = reducedMotion ? 0 : DRIFT_DURATION_S
        const animX = animateGlassValue(offsetX.current, 0, { duration, ease: glassEase })
        const animY = animateGlassValue(offsetY.current, 0, { duration, ease: glassEase })
        driftAnim.current = {
          stop() {
            animX.stop()
            animY.stop()
          },
        }
        if (IS_WEBKIT) setEpoch((e) => e + 1)
      },
      reducedMotion ? 600 : DRIFT_DELAY_MS,
    )
  }

  const dragBounds = () => {
    const maxOffsetX = Math.max(0, viewport.w - material.width - home.x)
    const minOffsetX = Math.min(0, -home.x)
    const maxOffsetY = Math.max(0, viewport.h - material.height - home.y)
    const minOffsetY = Math.min(0, -home.y)
    return { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY }
  }

  const onPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault()
    driftAnim.current?.stop()
    window.clearTimeout(driftTimer.current)

    const startX = event.clientX
    const startY = event.clientY
    const originX = offsetX.current.get()
    const originY = offsetY.current.get()

    const onMove = (move: globalThis.PointerEvent) => {
      const { minOffsetX, maxOffsetX, minOffsetY, maxOffsetY } = dragBounds()
      offsetX.current.set(Math.max(minOffsetX, Math.min(maxOffsetX, originX + move.clientX - startX)))
      offsetY.current.set(Math.max(minOffsetY, Math.min(maxOffsetY, originY + move.clientY - startY)))
    }

    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (IS_WEBKIT) setEpoch((e) => e + 1)
      scheduleDriftHome()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const ready = viewport.w > 0 && markWidth > 0
  const paneX = home.x + offsetX.current.get()
  const paneY = home.y + offsetY.current.get()
  const winX = paneX - MARGIN
  const winY = paneY - MARGIN
  const filterId = `og-mark-${baseId}-${epoch}`

  const lens =
    ready && typeof document !== 'undefined' ? (
      <div data-og-lens>
        <RefractingLens
          material={material}
          margin={MARGIN}
          filterId={filterId}
          mapUrl={mapUrl}
          winX={winX}
          winY={winY}
          sceneWidth={viewport.w}
          sceneHeight={viewport.h}
          baseColor={behind}
          renderScene={() => <PageBackdropClone onReclone={onReclone} />}
          position="fixed"
          zIndex={LENS_Z}
          boxMask={{ ...glassMarkMaskStyle(material, MARGIN, MARGIN), ...glassMarkShadowStyle() }}
          overlayMask={glassMarkMaskStyle(material, 0, 0)}
          invalidateKey={`${Math.round(paneX)},${Math.round(paneY)},${scroll.x},${scroll.y},${epoch}`}
          overlayStyle={{ cursor: 'grab', touchAction: 'none', zIndex: LENS_Z + 2 }}
          onOverlayPointerDown={onPointerDown}
        />
        <GlassMarkOutline
          width={material.width}
          height={material.height}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            transform: `translate3d(${paneX}px, ${paneY}px, 0)`,
            zIndex: LENS_Z + 1,
            pointerEvents: 'none',
          }}
        />
      </div>
    ) : null

  return (
    <>
      <div
        ref={anchorRef}
        className={className}
        aria-hidden
        style={{
          width: '100%',
          pointerEvents: 'none',
          ...style,
        }}
      />
      {lens ? createPortal(lens, document.body) : null}
    </>
  )
}
