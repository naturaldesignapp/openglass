# OpenGlass

A portable **glass material** for the web. OpenGlass gives you the two pieces every
glass/"liquid glass" effect needs and nothing you don't:

1. a **displacement map** that bends light at the rim (drives an SVG
   `feDisplacementMap` today, a WebGL shader tomorrow — same map), and
2. an unfiltered **rim + specular overlay** that reads as a real glass edge.

The material is described by a single plain options object, so the same numbers
drive a React SVG filter, a WebGL renderer, or a tuning UI. The displacement map
is the portable part — the idea comes from Aave's writeup
[_Building Glass for the Web_](https://aave.com/blog).

> **Scope.** This is a low-level library: it ships the `material` math and the
> `<OpenGlassFilter>` SVG component. It does **not** ship a batteries-included
> `<OpenGlass>` wrapper — you compose the host element yourself (a few lines,
> shown below). A drop-in component is on the [roadmap](#roadmap).

---

## Install

```bash
bun add openglass
# or
npm install openglass
# or
pnpm add openglass
```

`react` and `react-dom` (>= 18) are **peer dependencies** — bring your own.

> The displacement map and `<OpenGlassFilter>` need a browser DOM (`canvas`,
> SVG filters). In React Server Components, render the glass inside a
> `"use client"` component.

---

## Quick start

OpenGlass refracts whatever is **painted inside the filtered element**. The host
element must follow three layout rules (explained in [Host layout](#host-layout-the-rules-that-matter)):

```tsx
import { useId } from 'react'
import {
  OPEN_GLASS_DEFAULTS,
  OpenGlassFilter,
  openGlassOverlayStyle,
  type OpenGlassMaterial,
} from 'openglass'

// Extra content (px) fed to the filter so the rim samples real pixels
// instead of smearing the edge of the box.
const MARGIN = 24

export function GlassLens({
  material = OPEN_GLASS_DEFAULTS,
  children,
}: {
  material?: OpenGlassMaterial
  children?: React.ReactNode
}) {
  // Colons from useId() aren't valid in a CSS url(#id) selector — strip them.
  const filterId = `og-${useId().replace(/:/g, '')}`
  const boxW = material.width + MARGIN * 2
  const boxH = material.height + MARGIN * 2

  return (
    <div style={{ position: 'relative', width: material.width, height: material.height }}>
      {/* 1. The SVG filter. Renders nothing visible. */}
      <OpenGlassFilter id={filterId} material={material} margin={MARGIN} />

      {/* 2. Refracted layer: box is pane + 2*margin, pane centred, clipped. */}
      <div
        style={{
          position: 'absolute',
          left: -MARGIN,
          top: -MARGIN,
          width: boxW,
          height: boxH,
          overflow: 'hidden',
          filter: `url(#${filterId})`,
        }}
      >
        {/* Whatever should be refracted: a backdrop clone, an image, text… */}
        <div style={{ position: 'absolute', inset: 0 }}>{children}</div>
      </div>

      {/* 3. Unfiltered rim + glare, sized to the pane, drawn on top. */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          ...openGlassOverlayStyle(material),
        }}
      />
    </div>
  )
}
```

---

## Host layout: the rules that matter

The filter displaces the element's painted source, so the host has to be set up
precisely or the lens shifts or smears. Three rules:

1. **Box = pane + `2 * margin`, with the pane centred.** The filtered element is
   larger than the visible pane by `margin` on every side. The map is built for
   exactly this box (`makeOpenGlassDisplacementMap(material, margin)`), and the
   `<OpenGlassFilter>` filter region is sized to it.
2. **Clip the painted source** with `overflow: hidden`. The margin band feeds the
   displacement real pixels; without clipping you get fringing past the edge.
3. **Overlay goes on top, sized to the pane.** `openGlassOverlayStyle(material)`
   returns the rim ring + specular glare as plain CSS. It is *not* filtered.

### Refracting a backdrop

To make a lens that refracts content *behind* it (not its own children), render a
**positioned clone of the backdrop** inside the filtered layer, offset so it lines
up with the real backdrop under the lens. Keep the clone in sync as the lens moves.
This "clone sync" is host-specific and intentionally left to you.

---

## WebKit (Safari / Tauri WKWebView) caveats

WebKit needs two extra considerations that Chromium does not. Use
`isWebKitEngine()` to gate them.

- **Filter output is cached by `id`.** After a drag, a re-clone, or a material
  change, WebKit may keep showing stale filter output. Force a rebuild by passing
  a **fresh `id`** to `<OpenGlassFilter>` (e.g. append a version counter that you
  bump on change), and reference the same fresh id in `filter: url(#id)`.

  ```tsx
  const [rev, setRev] = useState(0)
  // bump `rev` after drags / material edits when isWebKitEngine()
  const filterId = `og-${baseId}-${rev}`
  ```

- **Don't blur inside the filter.** WebKit's `feGaussianBlur` shifts its output by
  a fraction of the radius, which visibly offsets the refracted backdrop. That's
  why `material.blur` is **not** applied in `<OpenGlassFilter>`. Instead, blur the
  **source DOM** with a CSS `filter: blur(${material.blur}px)` before it reaches
  the displacement filter — positionally exact in every engine.

The map's data URL is generated at the box's **intrinsic pixel size** on purpose:
WebKit anchors `feImage` by intrinsic pixels, so a size mismatch shifts the lens.

---

## API

Everything is exported from the package root.

### `OpenGlassMaterial`

The material is a plain object. Every field, with its tuning range:

| Field           | Type   | Default | Range        | Meaning |
|-----------------|--------|---------|--------------|---------|
| `width`         | px     | `240`   | 80…480       | Glass pane width. |
| `height`        | px     | `240`   | 80…480       | Glass pane height. |
| `borderRadius`  | px     | `120`   | 0…240        | Corner radius. `min(w,h)/2` ⇒ pill/circle. |
| `scale`         | px     | `30`    | 0…100        | Max refraction offset at the rim. |
| `depth`         | px     | `41`    | 2…120        | Width of the refracting bevel band, inward from the edge. |
| `curvature`     | —      | `2.8`   | 0.5…6        | Bevel profile exponent; higher concentrates the bend at the edge. |
| `splay`         | —      | `-1`    | -1…1         | Bend direction: `-1` pinches the rim (magnifies centre), `+1` bulges out. |
| `chroma`        | —      | `0.06`  | 0…1          | Chromatic aberration as a fraction of `scale`. `0` = off. |
| `blur`          | px     | `0`     | 0…8          | Post-displacement blur. Apply to the **source DOM**, not the filter. |
| `glow`          | 0…1    | `0.3`   | 0…1          | Directional specular glare intensity. |
| `edgeHighlight` | 0…1    | `0.55`  | 0…1          | Rim ring intensity. |
| `specularAngle` | deg    | `325`   | 0…360        | Direction of the glare (0 = top, clockwise). |

### Values & constants

- **`OPEN_GLASS_DEFAULTS: OpenGlassMaterial`** — the dialled-in default (circular lens).
- **`OPEN_GLASS_PARAMS: readonly OpenGlassParam[]`** — `{ key, label, min, max, decimals }`
  for each field, in display order. Feed it straight into a slider/tuning UI.

### Functions

- **`makeOpenGlassDisplacementMap(material, margin): string`** — builds the
  R/G-encoded displacement map as a `data:` URL sized to `pane + 2*margin`. Drives
  SVG `feDisplacementMap` or a WebGL shader. Requires a browser `canvas`.
- **`openGlassOverlayStyle(material): CSSProperties`** — the unfiltered rim ring +
  specular glare + shadows. Spread onto an absolutely-positioned overlay.
- **`openGlassRadius(material): number`** — effective corner radius, clamped so
  corners never overlap.
- **`isWebKitEngine(): boolean`** — `true` on Safari/WKWebView (and not Chromium),
  for gating the WebKit-only handling above.

### Components

- **`<OpenGlassFilter id material margin />`** — the SVG `<filter>` (displacement
  map + one displacement pass, or three `screen`-blended passes when `chroma > 0`).
  Render once per pane; the host points at it with `filter: url(#id)`.

  | Prop       | Type                | Notes |
  |------------|---------------------|-------|
  | `id`       | `string`            | Referenced as `filter: url(#id)`. Pass a fresh id to force a WebKit rebuild. |
  | `material` | `OpenGlassMaterial` | The material to render. |
  | `margin`   | `number`            | Extra content px around the pane fed to the filter. Must match the host box and the map. |

---

## Why a displacement map?

A single map is engine-agnostic: the same R/G offsets that drive an SVG
`feDisplacementMap` can be sampled by a WebGL/WebGPU shader. The map encodes the
bend directed along the rounded-rect edge normal, ramping inward over `depth` px
with a `curvature` profile, and is 4-fold symmetric (only the top-left quadrant is
computed, then mirrored). It's super-sampled to `devicePixelRatio` and downscaled
for a smooth ramp.

---

## Roadmap

- A batteries-included `<OpenGlass>` component that owns the host pattern
  (box sizing, clipping, overlay, WebKit id rebuild, backdrop clone sync).
- A WebGL renderer that consumes the same displacement map.

---

## License

[MIT](./LICENSE)
