import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { GlassControlLens } from './GlassControlLens'
import { OPEN_GLASS_DEFAULTS, type OpenGlassMaterial } from './material'
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

const EASE = cubicBezier(0.34, 1.36, 0.42, 1)
const SETTLE = cubicBezier(0.36, 0, 0.18, 1)
export const OPEN_GLASS_TAB_SLIDER_OPTICS: Partial<OpenGlassMaterial> = {
  scale: 14,
  depth: 17.7,
  curvature: 4.33,
  splay: -0.84,
  dome: 0.13,
  bodyZoom: -0.21,
  chroma: 0.52,
  glow: 0.45,
  edgeHighlight: 0.81,
  specularAngle: 325,
}

export interface OpenGlassTabSliderTuning {
  bloomWidth: number
  bloomHeight: number
  stretchWidthFactor: number
  stretchHeightFactor: number
  moveDuration: number
  expandDuration: number
  collapseDuration: number
  tapGlassDuration: number
  holdDelay: number
  holdStretch: number
  dragStretch: number
}

export const OPEN_GLASS_TAB_SLIDER_TUNING: OpenGlassTabSliderTuning = {
  bloomWidth: 1.32,
  bloomHeight: 1.6,
  stretchWidthFactor: 0.1,
  stretchHeightFactor: -0.27,
  moveDuration: 0.36,
  expandDuration: 0.14,
  collapseDuration: 0.38,
  tapGlassDuration: 0.24,
  holdDelay: 150,
  holdStretch: 0.14,
  dragStretch: 0.08,
}

const REST_SHADOW = '0 0 4px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(120, 120, 120, 0.18)'
const LENS_SHADOW = '0 3px 10px rgba(0, 0, 0, 0.18)'

export interface OpenGlassTabSliderItem<Value extends string = string> {
  value: Value
  label: ReactNode
  /** Relative slot width. @default 1 */
  weight?: number
  disabled?: boolean
}

export interface OpenGlassTabSliderChangeDetails {
  source: 'input' | 'drag'
}

export interface OpenGlassTabSliderProps<Value extends string = string> {
  items: readonly OpenGlassTabSliderItem<Value>[]
  value?: Value
  defaultValue?: Value
  onValueChange?: (
    value: Value,
    details: OpenGlassTabSliderChangeDetails,
  ) => void
  disabled?: boolean
  'aria-label'?: string
  /** Full tab-bar height. @default 44 */
  height?: number
  /** Inner gap between the track edge and resting selection. @default 4 */
  padding?: number
  /** Track colour. Must be opaque. */
  trackColor?: string
  /** Resting selected-pill colour. */
  selectionColor?: string
  /** Opaque colour behind lens overdrag. */
  surface?: string
  /** Optics overrides for the moving glass selection. */
  optics?: Partial<OpenGlassMaterial>
  /** Geometry and motion overrides for the selection lens. */
  tuning?: Partial<OpenGlassTabSliderTuning>
  /** Keep the selection bloomed for visual tuning. */
  forceExpanded?: boolean
  className?: string
  tabClassName?: string
  style?: CSSProperties
}

export interface OpenGlassTabMetric {
  left: number
  width: number
  center: number
}

export function buildOpenGlassTabMetrics(
  width: number,
  padding: number,
  weights: readonly number[],
): OpenGlassTabMetric[] {
  const safePadding = Math.max(0, Math.min(padding, width / 2))
  const available = Math.max(0, width - safePadding * 2)
  const safeWeights = weights.map((weight) => Math.max(0.001, weight))
  const total = safeWeights.reduce((sum, weight) => sum + weight, 0)
  let left = safePadding
  return safeWeights.map((weight) => {
    const tabWidth = available * (weight / total)
    const metric = { left, width: tabWidth, center: left + tabWidth / 2 }
    left += tabWidth
    return metric
  })
}

export function nearestOpenGlassTabIndex(
  center: number,
  metrics: readonly OpenGlassTabMetric[],
): number {
  if (metrics.length === 0) return -1
  let nearest = 0
  let distance = Math.abs(center - metrics[0].center)
  for (let index = 1; index < metrics.length; index += 1) {
    const nextDistance = Math.abs(center - metrics[index].center)
    if (nextDistance < distance) {
      nearest = index
      distance = nextDistance
    }
  }
  return nearest
}

/**
 * A segmented tab bar with a draggable OpenGlass selection. The selected tab
 * rests as a compact opaque pill, blooms into a highly chromatic refractive
 * lens on hold/drag, compresses vertically with horizontal velocity, wobbles,
 * and rubber-bands at the bar ends.
 */
export function OpenGlassTabSlider<Value extends string = string>({
  items,
  value,
  defaultValue,
  onValueChange,
  disabled,
  'aria-label': ariaLabel,
  height = 44,
  padding = 4,
  trackColor = '#ededeb',
  selectionColor = '#ffffff',
  surface = '#fafaf8',
  optics,
  tuning,
  forceExpanded = false,
  className,
  tabClassName,
  style,
}: OpenGlassTabSliderProps<Value>) {
  const fallbackValue = defaultValue ?? items[0]?.value
  const isControlled = value !== undefined
  const [internalValue, setInternalValue] = useState<Value | undefined>(fallbackValue)
  const currentValue = isControlled ? value : internalValue
  const activeIndex = Math.max(0, items.findIndex((item) => item.value === currentValue))
  const activeItem = items[activeIndex]
  const resolvedTuning = useMemo(
    () => ({ ...OPEN_GLASS_TAB_SLIDER_TUNING, ...tuning }),
    [tuning],
  )

  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const measure = () => setWidth(root.getBoundingClientRect().width)
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  const safePadding = Math.max(0, Math.min(padding, height / 2 - 0.5))
  const restH = Math.max(1, height - safePadding * 2)
  const metrics = useMemo(
    () => buildOpenGlassTabMetrics(width, safePadding, items.map((item) => item.weight ?? 1)),
    [width, safePadding, items],
  )
  const maxTabW = Math.max(1, ...metrics.map((metric) => metric.width))
  const lensWexp = maxTabW * resolvedTuning.bloomWidth
  const lensHexp = restH * resolvedTuning.bloomHeight
  const rubberLimit = Math.max(5, width * 0.045)
  const rubberRange = Math.max(1, rubberLimit * 24)
  const edge = Math.ceil(Math.max((lensWexp - maxTabW) / 2, (lensHexp - restH) / 2) + rubberLimit) + 2
  const boxW = Math.max(1, width + edge * 2)
  const boxH = height + edge * 2

  const material = useMemo<OpenGlassMaterial>(
    () => ({
      ...OPEN_GLASS_DEFAULTS,
      ...OPEN_GLASS_TAB_SLIDER_OPTICS,
      ...optics,
      width: lensWexp,
      height: lensHexp,
      borderRadius: lensHexp / 2,
    }),
    [optics, lensWexp, lensHexp],
  )

  const refs = useRef({ metrics, boxW, edge, width, restH, rubberLimit, rubberRange })
  useLayoutEffect(() => {
    refs.current = { metrics, boxW, edge, width, restH, rubberLimit, rubberRange }
  })

  const mv = useMemo(() => {
    const center = glassValue(0)
    const centerX = deriveGlass(
      [center],
      () => (refs.current.edge + center.get()) / refs.current.boxW,
    )
    const lensW = glassValue(1)
    const lensH = glassValue(restH)
    const radius = glassValue(restH / 2)
    const stretch = glassValue(0)
    const tintOpacity = glassValue(1)
    const shadowOpacity = glassValue(0)
    const restShadowOpacity = deriveGlass([shadowOpacity], () => 1 - shadowOpacity.get())
    return { center, centerX, lensW, lensH, radius, stretch, tintOpacity, shadowOpacity, restShadowOpacity }
    // Motion values intentionally live for the component lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reduced = usePrefersReducedMotion()
  const duration = (seconds: number) => (reduced ? 0 : seconds)
  const MOVE_ANIM = { ease: EASE, duration: duration(resolvedTuning.moveDuration) }
  const EXPAND_ANIM = { ease: EASE, duration: duration(resolvedTuning.expandDuration) }
  const COLLAPSE_ANIM = { ease: SETTLE, duration: duration(resolvedTuning.collapseDuration) }

  const holdRef = useRef(0)
  const kickWobbleRef = useRef<() => void>(() => {})
  useLensWobble(mv.center, mv.stretch, holdRef, kickWobbleRef)

  const pointerIdRef = useRef<number | null>(null)
  const interactionRef = useRef<'idle' | 'pending' | 'hold' | 'drag' | 'tap' | 'preview'>('idle')
  const startClientXRef = useRef(0)
  const grabOffsetRef = useRef(0)
  const pressedIndexRef = useRef(activeIndex)
  const movedRef = useRef(false)
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const moveAnimationRef = useRef<GlassAnimation | null>(null)
  const suppressClickRef = useRef(false)

  const metricFor = useCallback(
    (index: number) => metrics[Math.max(0, Math.min(index, metrics.length - 1))],
    [metrics],
  )

  const expand = useCallback((index: number) => {
    const metric = metricFor(index)
    if (!metric) return
    animateGlassValue(mv.lensW, metric.width * resolvedTuning.bloomWidth, EXPAND_ANIM)
    animateGlassValue(mv.lensH, lensHexp, EXPAND_ANIM)
    animateGlassValue(mv.radius, lensHexp / 2, EXPAND_ANIM)
    animateGlassValue(mv.tintOpacity, 0, EXPAND_ANIM)
    animateGlassValue(mv.shadowOpacity, 1, EXPAND_ANIM)
  }, [EXPAND_ANIM, lensHexp, metricFor, mv, resolvedTuning.bloomWidth])

  const collapse = useCallback((index: number) => {
    const metric = metricFor(index)
    if (!metric) return
    animateGlassValue(mv.lensW, metric.width, COLLAPSE_ANIM)
    animateGlassValue(mv.lensH, restH, COLLAPSE_ANIM)
    animateGlassValue(mv.radius, restH / 2, COLLAPSE_ANIM)
    animateGlassValue(mv.tintOpacity, 1, COLLAPSE_ANIM)
    animateGlassValue(mv.shadowOpacity, 0, COLLAPSE_ANIM)
  }, [COLLAPSE_ANIM, metricFor, mv, restH])

  const commit = useCallback((index: number, source: OpenGlassTabSliderChangeDetails['source']) => {
    const item = items[index]
    if (!item || item.disabled) return
    if (!isControlled) setInternalValue(item.value)
    if (item.value !== currentValue) onValueChange?.(item.value, { source })
  }, [currentValue, isControlled, items, onValueChange])

  const moveTo = useCallback((index: number, animate: boolean) => {
    const metric = metricFor(index)
    if (!metric) return
    moveAnimationRef.current?.stop()
    if (animate) {
      moveAnimationRef.current = animateGlassValue(mv.center, metric.center, MOVE_ANIM)
      animateGlassValue(mv.lensW, metric.width, MOVE_ANIM)
    } else {
      mv.center.set(metric.center)
      mv.lensW.set(metric.width)
    }
  }, [MOVE_ANIM, metricFor, mv.center, mv.lensW])

  useEffect(() => {
    if (forceExpanded) {
      interactionRef.current = 'preview'
      holdRef.current = 0
      moveTo(activeIndex, false)
      expand(activeIndex)
      return
    }
    if (interactionRef.current === 'preview') {
      interactionRef.current = 'idle'
      collapse(activeIndex)
    }
  }, [activeIndex, collapse, expand, forceExpanded, moveTo])

  useLayoutEffect(() => {
    const metric = metricFor(activeIndex)
    if (!metric || interactionRef.current !== 'idle') return
    if (width <= 0 || mv.center.get() === 0) {
      mv.center.set(metric.center)
      mv.lensW.set(metric.width)
      mv.lensH.set(restH)
      mv.radius.set(restH / 2)
      return
    }
    moveTo(activeIndex, true)
    collapse(activeIndex)
  }, [activeIndex, collapse, metricFor, moveTo, mv, restH, width])

  useEffect(
    () => () => {
      clearTimeout(holdTimeoutRef.current)
      clearTimeout(collapseTimeoutRef.current)
      moveAnimationRef.current?.stop()
    },
    [],
  )

  const releaseCapture = () => {
    const pointerId = pointerIdRef.current
    pointerIdRef.current = null
    const root = rootRef.current
    if (pointerId !== null && root) {
      try {
        if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId)
      } catch {
        // Pointer capture may already have been released by the browser.
      }
    }
  }

  const finishPointer = (cancelled: boolean) => {
    clearTimeout(holdTimeoutRef.current)
    releaseCapture()
    holdRef.current = 0
    const wasMoved = movedRef.current
    const wasHolding = interactionRef.current === 'hold'
    const selectedIndex = cancelled
      ? activeIndex
      : wasMoved
        ? nearestOpenGlassTabIndex(mv.center.get(), refs.current.metrics)
        : pressedIndexRef.current
    const safeIndex = selectedIndex < 0 ? activeIndex : selectedIndex
    moveTo(safeIndex, !reduced)
    if (cancelled || wasMoved || wasHolding) {
      interactionRef.current = 'idle'
      collapse(safeIndex)
    } else {
      interactionRef.current = 'tap'
      expand(safeIndex)
      clearTimeout(collapseTimeoutRef.current)
      collapseTimeoutRef.current = setTimeout(() => {
        interactionRef.current = 'idle'
        collapse(safeIndex)
      }, reduced ? 0 : resolvedTuning.tapGlassDuration * 1000)
    }
    if (!cancelled) commit(safeIndex, wasMoved ? 'drag' : 'input')
    requestAnimationFrame(() => {
      suppressClickRef.current = false
    })
  }

  const handleKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = index - 1
    else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = index + 1
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = items.length - 1
    else return
    event.preventDefault()
    const direction = nextIndex < index ? -1 : 1
    while (nextIndex >= 0 && nextIndex < items.length && items[nextIndex]?.disabled) {
      nextIndex += direction
    }
    nextIndex = Math.max(0, Math.min(items.length - 1, nextIndex))
    buttonRefs.current[nextIndex]?.focus()
    moveTo(nextIndex, false)
    collapse(nextIndex)
    commit(nextIndex, 'input')
  }

  const renderTabRow = (interactive: boolean) => (
    <div
      aria-hidden={interactive ? undefined : true}
      style={{
        position: 'absolute',
        inset: safePadding,
        display: 'flex',
        alignItems: 'stretch',
      }}
    >
      {items.map((item, index) => {
        const selected = index === activeIndex
        const commonStyle: CSSProperties = {
          boxSizing: 'border-box',
          flex: `${Math.max(0.001, item.weight ?? 1)} 1 0`,
          minWidth: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }
        if (!interactive) {
          return (
            <div key={item.value} className={tabClassName} style={commonStyle}>
              {item.label}
            </div>
          )
        }
        return (
          <button
            key={item.value}
            ref={(node) => {
              buttonRefs.current[index] = node
            }}
            type="button"
            role="tab"
            className={tabClassName}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            disabled={disabled || item.disabled}
            data-active={selected || undefined}
            style={commonStyle}
            onClick={(event) => {
              if (event.detail > 0 || suppressClickRef.current) return
              moveTo(index, false)
              collapse(index)
              commit(index, 'input')
            }}
            onKeyDown={(event) => handleKeyboard(event, index)}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )

  const refract = (
    <div
      style={{
        position: 'absolute',
        left: edge,
        top: edge,
        width,
        height,
        borderRadius: height / 2,
        overflow: 'hidden',
        background: trackColor,
      }}
    >
      {renderTabRow(false)}
    </div>
  )

  return (
    <div
      ref={rootRef}
      role="tablist"
      aria-label={ariaLabel}
      aria-disabled={disabled || undefined}
      className={className}
      style={{
        boxSizing: 'border-box',
        width: '100%',
        height,
        position: 'relative',
        flexShrink: 0,
        borderRadius: height / 2,
        background: trackColor,
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        ...style,
        opacity: disabled ? 0.45 : style?.opacity,
      }}
      onPointerDown={(event) => {
        if (disabled || pointerIdRef.current !== null || metrics.length === 0) return
        event.preventDefault()
        const rect = event.currentTarget.getBoundingClientRect()
        const localX = event.clientX - rect.left
        const pressedIndex = nearestOpenGlassTabIndex(localX, metrics)
        const pressedItem = items[pressedIndex]
        if (!pressedItem || pressedItem.disabled) return
        buttonRefs.current[pressedIndex]?.focus({ preventScroll: true })
        pointerIdRef.current = event.pointerId
        event.currentTarget.setPointerCapture(event.pointerId)
        suppressClickRef.current = true
        interactionRef.current = 'pending'
        pressedIndexRef.current = pressedIndex
        movedRef.current = false
        startClientXRef.current = event.clientX
        const currentMetric = metricFor(activeIndex)
        const withinLens = currentMetric
          ? Math.abs(localX - mv.center.get()) <= mv.lensW.get() / 2
          : false
        grabOffsetRef.current = withinLens ? localX - mv.center.get() : 0
        clearTimeout(holdTimeoutRef.current)
        clearTimeout(collapseTimeoutRef.current)
        expand(activeIndex)
        holdTimeoutRef.current = setTimeout(() => {
          if (interactionRef.current !== 'pending') return
          interactionRef.current = 'hold'
          expand(activeIndex)
          holdRef.current = resolvedTuning.holdStretch
          kickWobbleRef.current()
        }, resolvedTuning.holdDelay)
      }}
      onPointerMove={(event) => {
        if (event.pointerId !== pointerIdRef.current) return
        const delta = event.clientX - startClientXRef.current
        if (!movedRef.current) {
          if (Math.abs(delta) < 3) return
          movedRef.current = true
          interactionRef.current = 'drag'
          clearTimeout(holdTimeoutRef.current)
          moveAnimationRef.current?.stop()
          expand(activeIndex)
          holdRef.current = resolvedTuning.dragStretch
          kickWobbleRef.current()
        }
        const rect = event.currentTarget.getBoundingClientRect()
        let next = event.clientX - rect.left - grabOffsetRef.current
        const first = refs.current.metrics[0]
        const last = refs.current.metrics[refs.current.metrics.length - 1]
        if (!first || !last) return
        const min = first.center
        const max = last.center
        if (next < min) next = min - rubberBand(min - next, refs.current.rubberLimit, refs.current.rubberRange)
        else if (next > max) next = max + rubberBand(next - max, refs.current.rubberLimit, refs.current.rubberRange)
        mv.center.set(next)
      }}
      onPointerUp={(event) => {
        if (event.pointerId !== pointerIdRef.current) return
        finishPointer(false)
      }}
      onPointerCancel={(event) => {
        if (event.pointerId !== pointerIdRef.current) return
        finishPointer(true)
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      {renderTabRow(true)}

      {width > 0 && activeItem ? (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: -edge,
            top: -edge,
            width: boxW,
            height: boxH,
            pointerEvents: 'none',
          }}
        >
          <GlassControlLens
            material={material}
            boxW={boxW}
            boxH={boxH}
            behind={surface}
            refract={refract}
            centerX={mv.centerX}
            lensW={mv.lensW}
            lensH={mv.lensH}
            radius={mv.radius}
            stretch={mv.stretch}
            stretchWidthFactor={resolvedTuning.stretchWidthFactor}
            stretchHeightFactor={resolvedTuning.stretchHeightFactor}
            stretchMin={0}
            tintOpacity={mv.tintOpacity}
            tintColor={selectionColor}
            restContent={<span style={{ color: 'inherit' }}>{activeItem.label}</span>}
            shadowOpacity={mv.shadowOpacity}
            restShadowOpacity={mv.restShadowOpacity}
            edgeShadow={LENS_SHADOW}
            restEdgeShadow={REST_SHADOW}
          />
        </div>
      ) : null}
    </div>
  )
}
