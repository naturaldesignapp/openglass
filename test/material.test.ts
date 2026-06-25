import { describe, expect, test } from 'bun:test'
import {
  OPEN_GLASS_DEFAULTS,
  OPEN_GLASS_PARAMS,
  OpenGlass,
  OpenGlassFilter,
  OpenGlassSlider,
  OpenGlassTabSlider,
  OpenGlassToggle,
  buildOpenGlassTabMetrics,
  nearestOpenGlassTabIndex,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from '../src/index'
import { updateOpenGlassToggleDragChecked } from '../src/OpenGlassToggle'

describe('openGlassRadius', () => {
  test('returns the requested radius when it fits', () => {
    expect(openGlassRadius({ ...OPEN_GLASS_DEFAULTS, width: 400, height: 400, borderRadius: 40 })).toBe(40)
  })

  test('clamps to half the smaller dimension so corners never overlap', () => {
    expect(openGlassRadius({ ...OPEN_GLASS_DEFAULTS, width: 100, height: 200, borderRadius: 999 })).toBe(50)
  })

  test('never goes negative', () => {
    expect(openGlassRadius({ ...OPEN_GLASS_DEFAULTS, borderRadius: -10 })).toBe(0)
  })
})

describe('openGlassOverlayStyle', () => {
  const style = openGlassOverlayStyle(OPEN_GLASS_DEFAULTS)

  test('exposes a clamped border radius', () => {
    expect(style.borderRadius).toBe(openGlassRadius(OPEN_GLASS_DEFAULTS))
  })

  test('produces rim + glare gradients and edge shadows', () => {
    expect(typeof style.background).toBe('string')
    expect(style.background as string).toContain('radial-gradient')
    expect(style.boxShadow as string).toContain('inset')
  })

  test('moves the specular highlight with specularAngle', () => {
    const top = openGlassOverlayStyle({ ...OPEN_GLASS_DEFAULTS, specularAngle: 0 }).background as string
    const right = openGlassOverlayStyle({ ...OPEN_GLASS_DEFAULTS, specularAngle: 90 }).background as string
    expect(top).not.toBe(right)
  })
})

describe('material constants', () => {
  test('every tuning param maps to a real material key', () => {
    const keys = new Set(Object.keys(OPEN_GLASS_DEFAULTS) as (keyof OpenGlassMaterial)[])
    for (const param of OPEN_GLASS_PARAMS) {
      expect(keys.has(param.key)).toBe(true)
      expect(param.min).toBeLessThanOrEqual(param.max)
    }
  })

  test('defaults fall inside their tuning ranges', () => {
    for (const param of OPEN_GLASS_PARAMS) {
      const value = OPEN_GLASS_DEFAULTS[param.key]
      expect(value).toBeGreaterThanOrEqual(param.min)
      expect(value).toBeLessThanOrEqual(param.max)
    }
  })

  test('exposes dome shape and signed body zoom independently', () => {
    const dome = OPEN_GLASS_PARAMS.find((param) => param.key === 'dome')
    const bodyZoom = OPEN_GLASS_PARAMS.find((param) => param.key === 'bodyZoom')
    expect(dome?.min).toBe(0)
    expect(bodyZoom?.min).toBeLessThan(0)
    expect(bodyZoom?.max).toBeGreaterThan(0)
    expect(typeof OPEN_GLASS_DEFAULTS.dome).toBe('number')
    expect(typeof OPEN_GLASS_DEFAULTS.bodyZoom).toBe('number')
  })
})

describe('public components', () => {
  test('the drop-in and controls are exported as components', () => {
    for (const component of [OpenGlass, OpenGlassFilter, OpenGlassToggle, OpenGlassSlider, OpenGlassTabSlider]) {
      expect(typeof component).toBe('function')
    }
  })
})

describe('OpenGlassTabSlider geometry', () => {
  test('builds weighted slots inside the requested padding', () => {
    const metrics = buildOpenGlassTabMetrics(220, 10, [1, 2, 1])
    expect(metrics).toHaveLength(3)
    expect(metrics[0]).toEqual({ left: 10, width: 50, center: 35 })
    expect(metrics[1]).toEqual({ left: 60, width: 100, center: 110 })
    expect(metrics[2]).toEqual({ left: 160, width: 50, center: 185 })
  })

  test('selects the tab with the nearest center', () => {
    const metrics = buildOpenGlassTabMetrics(220, 10, [1, 2, 1])
    expect(nearestOpenGlassTabIndex(12, metrics)).toBe(0)
    expect(nearestOpenGlassTabIndex(100, metrics)).toBe(1)
    expect(nearestOpenGlassTabIndex(208, metrics)).toBe(2)
  })
})

describe('OpenGlassToggle drag state', () => {
  test('emits only when a drag crosses the checked-state midpoint', () => {
    const changes: boolean[] = []
    const onChange = (checked: boolean) => changes.push(checked)
    let checked = false

    checked = updateOpenGlassToggleDragChecked(checked, 3.5, 7, onChange)
    expect(checked).toBe(false)
    expect(changes).toEqual([])

    checked = updateOpenGlassToggleDragChecked(checked, 4, 7, onChange)
    expect(checked).toBe(true)
    expect(changes).toEqual([true])

    checked = updateOpenGlassToggleDragChecked(checked, 6, 7, onChange)
    expect(changes).toEqual([true])

    checked = updateOpenGlassToggleDragChecked(checked, 3, 7, onChange)
    expect(checked).toBe(false)
    expect(changes).toEqual([true, false])
  })
})
