import type { CSSProperties } from 'react'

// ---------------------------------------------------------------------------
// OpenGlass — a portable glass material.
//
// The material is described by a plain options object (`OpenGlassMaterial`).
// From it we derive the three pieces every renderer needs:
//
//   1. `makeOpenGlassDisplacementMap()` — an R/G-encoded displacement map
//      (data URL) for SVG `feDisplacementMap` or a WebGL shader.
//   2. `openGlassOverlayStyle()` — the unfiltered CSS rim/glare overlay.
//   3. The filter scale: `material.scale * 2` fed to `feDisplacementMap`.
//
// The displacement map is the portable part (per Aave's "Building Glass for
// the Web") — the same map drives SVG filters and WebGL alike.
// ---------------------------------------------------------------------------

export interface OpenGlassMaterial {
  /** Glass pane width in px. */
  width: number
  /** Glass pane height in px. */
  height: number
  /** Corner radius in px. `min(width, height) / 2` makes a pill/circle. */
  borderRadius: number
  /** Max refraction offset at the rim, in px. */
  scale: number
  /** Width of the refracting bevel band, in px, measured inward from the edge. */
  depth: number
  /** Bevel profile exponent — higher concentrates the bend at the edge. */
  curvature: number
  /** Bend direction/amount: -1 pinches the rim (magnifies centre), +1 bulges outward. */
  splay: number
  /**
   * Convex spherical-cap magnification of the body — the "liquid" middle of
   * real glass, 0..1. `0` is a flat window that only bends at the rim; `1` is a
   * full hemisphere dome that magnifies the centre. Layered on top of the rim
   * bevel (`depth`/`curvature`/`splay`), it gives the lens true lens-like depth.
   */
  dome: number
  /** Chromatic aberration as a fraction of `scale`. 0 = off. */
  chroma: number
  /** Post-displacement blur in px. 0 = off. */
  blur: number
  /** Directional specular glare intensity, 0..1. */
  glow: number
  /** Rim ring intensity, 0..1. */
  edgeHighlight: number
  /** Direction the specular glare comes from, in degrees (0 = top, clockwise). */
  specularAngle: number
}

/** The dialled-in default material (circular lens). */
export const OPEN_GLASS_DEFAULTS: OpenGlassMaterial = {
  width: 240,
  height: 240,
  borderRadius: 120,
  scale: 30,
  depth: 41,
  curvature: 2.8,
  splay: -1,
  dome: 0.4,
  chroma: 0.06,
  blur: 0,
  glow: 0.3,
  edgeHighlight: 0.55,
  specularAngle: 325,
}

export interface OpenGlassParam {
  key: keyof OpenGlassMaterial
  label: string
  min: number
  max: number
  /** Decimal places to show in tuning UIs. */
  decimals: number
}

/** Tuning ranges for every material parameter, in display order. */
export const OPEN_GLASS_PARAMS: readonly OpenGlassParam[] = [
  { key: 'width', label: 'Width', min: 80, max: 480, decimals: 0 },
  { key: 'height', label: 'Height', min: 80, max: 480, decimals: 0 },
  { key: 'borderRadius', label: 'Border Radius', min: 0, max: 240, decimals: 0 },
  { key: 'scale', label: 'Scale', min: 0, max: 100, decimals: 0 },
  { key: 'depth', label: 'Depth', min: 2, max: 120, decimals: 0 },
  { key: 'curvature', label: 'Curvature', min: 0.5, max: 6, decimals: 2 },
  { key: 'splay', label: 'Splay', min: -1, max: 1, decimals: 2 },
  { key: 'dome', label: 'Dome', min: 0, max: 1, decimals: 2 },
  { key: 'chroma', label: 'Chroma', min: 0, max: 1, decimals: 2 },
  { key: 'blur', label: 'Blur', min: 0, max: 8, decimals: 1 },
  { key: 'glow', label: 'Glow', min: 0, max: 1, decimals: 2 },
  { key: 'edgeHighlight', label: 'Edge Highlight', min: 0, max: 1, decimals: 2 },
  { key: 'specularAngle', label: 'Specular Angle', min: 0, max: 360, decimals: 0 },
]

/**
 * Tauri WKWebView and Safari both report AppleWebKit without Chrome. WebKit
 * needs extra filter-invalidation work (see the OpenGlass docs); Chromium
 * does not.
 */
export function isWebKitEngine(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /AppleWebKit/i.test(navigator.userAgent) &&
    !/Chrome|Chromium|CriOS|Edg/i.test(navigator.userAgent)
  )
}

/** Effective corner radius (clamped so corners never overlap). */
export function openGlassRadius(material: OpenGlassMaterial): number {
  return Math.max(0, Math.min(material.borderRadius, Math.min(material.width, material.height) / 2))
}

/**
 * Builds the displacement map for the material: a neutral (128) field with a
 * centred rounded-rect pane whose R/G channels encode a bend directed along
 * the edge normal, ramping in over `depth` px with a `curvature` profile.
 *
 * The map covers the pane plus `margin` px on every side (the same margin of
 * real content the filter source must include so the rim never smears).
 * Returned as a data URL whose intrinsic size is exactly the box size —
 * WebKit anchors `feImage` by intrinsic pixels, so a mismatch shifts the lens.
 */
export function makeOpenGlassDisplacementMap(material: OpenGlassMaterial, margin: number): string {
  const boxW = Math.round(material.width + margin * 2)
  const boxH = Math.round(material.height + margin * 2)
  // Super-sample for a smooth ramp, then downscale to the intrinsic box size.
  const ss = Math.min(Math.max(Math.round((typeof window !== 'undefined' && window.devicePixelRatio) || 1), 1), 3)
  const resW = boxW * ss
  const resH = boxH * ss

  const hi = document.createElement('canvas')
  hi.width = resW
  hi.height = resH
  const ctx = hi.getContext('2d')
  if (!ctx) return ''
  const image = ctx.createImageData(resW, resH)

  const cx = resW / 2
  const cy = resH / 2
  const bx = (material.width / 2) * ss
  const by = (material.height / 2) * ss
  const radius = openGlassRadius(material) * ss
  const depth = Math.max(material.depth, 0.001) * ss
  const { splay, curvature } = material

  // Spherical-cap dome (the convex "liquid" body). The cap height is `dome` ×
  // the half-extent; from chord half-width `a` and cap height `h` the sphere
  // radius is R = (a² + h²) / 2h. We sample the dome gradient per axis and
  // normalise it to 1 at the rim, so `dome` alone sets the amount of bulge while
  // `scale` (the filter) sets the px amplitude. 4-fold symmetric like the bevel.
  const dome = Math.max(0, material.dome)
  const domeCapX = dome > 0 ? Math.max(0.01, Math.min(dome * bx, bx - 1)) : 0
  const domeCapY = dome > 0 ? Math.max(0.01, Math.min(dome * by, by - 1)) : 0
  const domeRx = domeCapX > 0 ? (bx * bx + domeCapX * domeCapX) / (2 * domeCapX) : 0
  const domeRy = domeCapY > 0 ? (by * by + domeCapY * domeCapY) / (2 * domeCapY) : 0
  const domeEdgeX = domeRx > bx ? bx / Math.sqrt(domeRx * domeRx - bx * bx) : 0
  const domeEdgeY = domeRy > by ? by / Math.sqrt(domeRy * domeRy - by * by) : 0

  // The map is 4-fold symmetric, so compute only the top-left quadrant and
  // mirror it with sign flips on the R/G offsets (Aave optimization).
  const halfW = Math.ceil(resW / 2)
  const halfH = Math.ceil(resH / 2)
  for (let y = 0; y < halfH; y++) {
    const my = resH - 1 - y
    for (let x = 0; x < halfW; x++) {
      const mx = resW - 1 - x
      // Rounded-rect SDF in quadrant (absolute) coordinates.
      const px = Math.abs(x + 0.5 - cx)
      const py = Math.abs(y + 0.5 - cy)
      const qx = px - (bx - radius)
      const qy = py - (by - radius)

      // Body dome — per-axis convex magnification, only inside the pane bounds.
      // It magnifies the centre (the splay=-1 sense), so it adds positively to
      // the absolute-quadrant offset like the rim bevel does.
      let offsetX = 0
      let offsetY = 0
      if (dome > 0 && px < bx && py < by) {
        offsetX = dome * domeAxis(px, domeRx, domeEdgeX)
        offsetY = dome * domeAxis(py, domeRy, domeEdgeY)
      }

      if (qx > 0 && qy > 0) {
        // Rounded-corner arc — and the entire area of a circle/ellipse, whose
        // corner zone covers the whole quadrant. Bend radially out of the arc
        // centre so the refraction follows the curve.
        const len = Math.hypot(qx, qy)
        if (len < radius) {
          const inward = radius - len
          if (inward < depth) {
            const magnitude = splay * Math.pow(1 - inward / depth, curvature)
            const dirX = len > 0 ? qx / len : Math.SQRT1_2
            const dirY = len > 0 ? qy / len : Math.SQRT1_2
            // Quadrant coords are absolute; the outward normal points toward -x/-y.
            offsetX += -dirX * magnitude
            offsetY += -dirY * magnitude
          }
        } else {
          // The rounded-corner cutout is outside the shape — stay neutral.
          offsetX = 0
          offsetY = 0
        }
      } else {
        // Flat edges and interior. Bend each axis independently by its own
        // distance to the nearest edge. Unlike snapping the whole vector to the
        // dominant edge, this stays continuous across the diagonal medial axis
        // (where two edges are equidistant), so deep bevels on sharp/low-radius
        // corners no longer show a hard seam shooting in from each corner.
        const inX = bx - px
        const inY = by - py
        if (inX > 0 && inX < depth) offsetX += -splay * Math.pow(1 - inX / depth, curvature)
        if (inY > 0 && inY < depth) offsetY += -splay * Math.pow(1 - inY / depth, curvature)
      }

      const rPos = clampByte(128 + offsetX * 127)
      const rNeg = clampByte(128 - offsetX * 127)
      const gPos = clampByte(128 + offsetY * 127)
      const gNeg = clampByte(128 - offsetY * 127)
      writeMapPixel(image.data, resW, x, y, rPos, gPos)
      writeMapPixel(image.data, resW, mx, y, rNeg, gPos)
      writeMapPixel(image.data, resW, x, my, rPos, gNeg)
      writeMapPixel(image.data, resW, mx, my, rNeg, gNeg)
    }
  }
  ctx.putImageData(image, 0, 0)
  if (ss === 1) return hi.toDataURL()

  const out = document.createElement('canvas')
  out.width = boxW
  out.height = boxH
  const octx = out.getContext('2d')
  if (!octx) return hi.toDataURL()
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(hi, 0, 0, boxW, boxH)
  return out.toDataURL()
}

/**
 * Builds a displacement map from an arbitrary opaque silhouette instead of a
 * rounded rect. `drawShape` paints the shape (any opaque fill) in pane-local
 * coordinates: (0,0) at the pane's top-left, (width, height) at its
 * bottom-right. The context is already offset by `margin` and super-sampled, so
 * the callback only draws the shape.
 *
 * Every edge of the painted silhouette gets the same rim bevel
 * (`depth`/`curvature`/`splay`) the rounded-rect map gives a pane, so a glyph or
 * logo refracts along its own outline — including the inner edges of a shape
 * made of separate pieces. `dome` is not applied (a free-form shape has no
 * single centre to bulge). Returned as a data URL sized to the box.
 */
export function makeOpenGlassShapeMap(
  material: OpenGlassMaterial,
  margin: number,
  drawShape: (ctx: CanvasRenderingContext2D) => void,
): string {
  const boxW = Math.round(material.width + margin * 2)
  const boxH = Math.round(material.height + margin * 2)
  const ss = Math.min(Math.max(Math.round((typeof window !== 'undefined' && window.devicePixelRatio) || 1), 1), 2)
  const resW = boxW * ss
  const resH = boxH * ss
  const n = resW * resH

  const shapeCanvas = document.createElement('canvas')
  shapeCanvas.width = resW
  shapeCanvas.height = resH
  const sctx = shapeCanvas.getContext('2d')
  if (!sctx) return ''
  sctx.setTransform(ss, 0, 0, ss, margin * ss, margin * ss)
  sctx.fillStyle = '#fff'
  drawShape(sctx)

  const alpha = sctx.getImageData(0, 0, resW, resH).data
  const INF = 1e20
  // Inside the shape ⇒ ∞ (distance to be measured), outside ⇒ 0 (a seed).
  const grid = new Float64Array(n)
  for (let i = 0; i < n; i++) grid[i] = alpha[i * 4 + 3] > 32 ? INF : 0
  // Squared Euclidean distance from every inside pixel to the nearest edge.
  squaredDistanceTransform(grid, resW, resH)
  const dist = new Float64Array(n)
  for (let i = 0; i < n; i++) dist[i] = Math.sqrt(grid[i])

  const depth = Math.max(material.depth, 0.001) * ss
  const { splay, curvature } = material

  const image = new ImageData(resW, resH)
  const data = image.data
  for (let y = 0; y < resH; y++) {
    for (let x = 0; x < resW; x++) {
      const i = y * resW + x
      let offsetX = 0
      let offsetY = 0
      const d = dist[i]
      if (d > 0 && d < depth) {
        // The distance field rises inward, so its gradient points inward and
        // the outward edge normal is its negation. Bend along that normal.
        const gx = dist[x < resW - 1 ? i + 1 : i] - dist[x > 0 ? i - 1 : i]
        const gy = dist[y < resH - 1 ? i + resW : i] - dist[y > 0 ? i - resW : i]
        const glen = Math.hypot(gx, gy)
        if (glen > 1e-4) {
          const magnitude = splay * Math.pow(1 - d / depth, curvature)
          offsetX = -(gx / glen) * magnitude
          offsetY = -(gy / glen) * magnitude
        }
      }
      const j = i * 4
      data[j] = clampByte(128 + offsetX * 127)
      data[j + 1] = clampByte(128 + offsetY * 127)
      data[j + 2] = 128
      data[j + 3] = 255
    }
  }

  const hi = document.createElement('canvas')
  hi.width = resW
  hi.height = resH
  const hctx = hi.getContext('2d')
  if (!hctx) return ''
  hctx.putImageData(image, 0, 0)
  if (ss === 1) return hi.toDataURL()
  const out = document.createElement('canvas')
  out.width = boxW
  out.height = boxH
  const octx = out.getContext('2d')
  if (!octx) return hi.toDataURL()
  octx.imageSmoothingEnabled = true
  octx.imageSmoothingQuality = 'high'
  octx.drawImage(hi, 0, 0, boxW, boxH)
  return out.toDataURL()
}

/**
 * The unfiltered glass overlay: a concentric rim ring (`edgeHighlight`) that
 * gives the pane an always-on glass edge, plus a directional specular glare
 * (`glow` at `specularAngle`). Render it on top of the refracted content.
 */
export function openGlassOverlayStyle(material: OpenGlassMaterial): CSSProperties {
  const eh = material.edgeHighlight
  const rad = (material.specularAngle * Math.PI) / 180
  const gx = 50 + Math.sin(rad) * 30
  const gy = 50 - Math.cos(rad) * 30
  return {
    borderRadius: openGlassRadius(material),
    background: [
      `radial-gradient(100% 100% at 50% 50%, rgba(255,255,255,0) 70%, rgba(255,255,255,${round2(eh)}) 85%, rgba(255,255,255,${round2(eh * 0.15)}) 93%, rgba(255,255,255,0) 100%)`,
      `radial-gradient(120% 120% at ${round2(gx)}% ${round2(gy)}%, rgba(255,255,255,${round2(material.glow)}), rgba(255,255,255,0) 40%)`,
    ].join(', '),
    boxShadow: [
      `inset 0 1px 1px rgba(255,255,255,${round2(eh)})`,
      `inset 0 0 0 1px rgba(255,255,255,${round2(eh * 0.4)})`,
      'inset 0 -10px 20px rgba(0,0,0,0.06)',
      '0 10px 30px rgba(0,0,0,0.18)',
    ].join(', '),
  }
}

function writeMapPixel(
  data: Uint8ClampedArray,
  rowWidth: number,
  x: number,
  y: number,
  r: number,
  g: number,
): void {
  const i = (y * rowWidth + x) * 4
  data[i] = r
  data[i + 1] = g
  data[i + 2] = 128
  data[i + 3] = 255
}

/**
 * Spherical-cap dome gradient along one axis, normalised to 1 at the rim:
 * `x / √(R² − x²)` is the slope of a sphere of radius `R`, which is 0 at the
 * centre and rises toward the edge — the convex lens profile. `edgeGrad` is that
 * slope at the half-extent, so the result is 0 at the centre and 1 at the rim.
 */
function domeAxis(p: number, R: number, edgeGrad: number): number {
  if (edgeGrad <= 0 || R <= 0) return 0
  const inside = Math.min(p, R * (1 - 1e-3))
  return inside / Math.sqrt(R * R - inside * inside) / edgeGrad
}

// Exact Euclidean distance transform (Felzenszwalb & Huttenlocher), in place.
// `grid` holds 0 at seed pixels and ∞ elsewhere; on return it holds the squared
// distance from each pixel to the nearest seed. Separable: 1-D transform down
// every column, then across every row.
function squaredDistanceTransform(grid: Float64Array, w: number, h: number): void {
  const span = Math.max(w, h)
  const f = new Float64Array(span)
  const d = new Float64Array(span)
  const v = new Int32Array(span)
  const z = new Float64Array(span + 1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x]
    edt1d(f, h, d, v, z)
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y]
  }
  for (let y = 0; y < h; y++) {
    const row = y * w
    for (let x = 0; x < w; x++) f[x] = grid[row + x]
    edt1d(f, w, d, v, z)
    for (let x = 0; x < w; x++) grid[row + x] = d[x]
  }
}

// 1-D squared distance transform of `f` into `d`; `v`/`z` are scratch buffers
// (parabola vertices and their intersection abscissae).
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array): void {
  let k = 0
  v[0] = 0
  z[0] = -Infinity
  z[1] = Infinity
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    while (s <= z[k]) {
      k--
      s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k])
    }
    k++
    v[k] = q
    z[k] = s
    z[k + 1] = Infinity
  }
  k = 0
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++
    const dx = q - v[k]
    d[q] = dx * dx + f[v[k]]
  }
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function round2(value: number): number {
  return Math.round(value * 100) / 100
}
