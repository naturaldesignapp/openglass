import { describe, expect, test } from 'bun:test'
import {
  OPEN_GLASS_DEFAULTS,
  OPEN_GLASS_PARAMS,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from '../src/index'

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
})
