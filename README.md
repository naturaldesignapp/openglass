# OpenGlass

**[▶ Live demo](https://naturaldesignapp.github.io/openglass/)** — drag the lens, tune the material.

A portable **glass material** for the web. OpenGlass gives you the two pieces every
glass/"liquid glass" effect needs and nothing you don't:

1. a **displacement map** that bends light at the rim (drives an SVG
   `feDisplacementMap` today, a WebGL shader tomorrow — same map), and
2. an unfiltered **rim + specular overlay** that reads as a real glass edge.

The material is described by a single plain options object, so the same numbers
drive a React SVG filter, a WebGL renderer, or a tuning UI. The displacement map
is the portable part — the idea comes from Aave's writeup
[_Building Glass for the Web_](https://aave.com/blog).

> **Scope.** OpenGlass ships at two levels. Reach for the **drop-in** when you
> just want glass: `<OpenGlass>` owns the host layout (box sizing, clipping,
> rim/glare overlay, the refract-a-copy path, and the WebKit filter rebuild),
> and `<OpenGlassToggle>` / `<OpenGlassSlider>` are finished, accessible controls
> built on it. Reach for the **primitives** (`material` + `<OpenGlassFilter>`)
> when you want to own the host yourself. Both are shown below.

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

## Quick start (drop-in)

`<OpenGlass>` is the batteries-included lens. Hand it the content to refract and
it owns the rest. A **copy** of `refract` is bent, so it works in Chrome, Safari
and Firefox; `children` render crisp on top.

```tsx
import { OpenGlass } from 'openglass'

// A loupe floating over a photo. The lens copies the image and bends it; the
// label stays sharp on top.
;<OpenGlass
  material={{ width: 160, height: 160, borderRadius: 80, scale: 24, dome: 0.5 }}
  refract={<img src="/photo.jpg" width={640} height={400} alt="" />}
  surfaceWidth={640}
  surfaceHeight={400}
  surfaceX={240}
  surfaceY={120}
  behind="#111"
>
  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
    Zoom
  </span>
</OpenGlass>
```

- **`refract`** is the content the lens bends (a copy). Omit it to bend the
  `children` in place (e.g. glassify a hero).
- **`surfaceWidth/Height`** size that copy and **`surfaceX/Y`** place the lens
  over it — so a small lens can float over a big surface (a slider track, a
  photo) with the refraction lined up under it.
- **`material`** is a `Partial<OpenGlassMaterial>` merged over the defaults;
  pass only what you change.
- **`invalidateKey`** — bump it (or change `surfaceX/Y`) whenever the source
  moves so WebKit re-runs the filter. The displacement map only depends on
  shape, so moving the lens never rebuilds it.

### Components

Finished, accessible controls whose moving part is a real lens:

```tsx
import { OpenGlassToggle, OpenGlassSlider } from 'openglass'

;<OpenGlassToggle checked={on} onCheckedChange={setOn} aria-label="Wi-Fi" />
;<OpenGlassSlider value={v} onValueChange={setV} aria-label="Volume" />
```

`OpenGlassToggle` is a `role="switch"` whose glass thumb slides and bends the
track through it. `OpenGlassSlider` is a `role="slider"` (drag, click, arrow /
Page / Home / End keys) whose handle refracts the fill beneath it. Both are
controllable or uncontrolled, honour `prefers-reduced-motion`, and take an
`optics` prop to restyle the glass.

---

## Quick start (primitives)

For full control over the host, drive the filter yourself. OpenGlass refracts
whatever is **painted inside the filtered element**. The host element must follow
three layout rules (explained in [Host layout](#host-layout-the-rules-that-matter)):

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

WebKit needs three extra considerations that Chromium does not. Use
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

- **Keep the refracted source free of nested CSS filters.** If the content fed to
  the displacement filter *itself* contains `filter:` or `backdrop-filter:`
  elements, WebKit silently bails on the outer displacement the moment the source
  DOM blur above is stacked on top — the backdrop still blurs but the distortion
  and chroma vanish. Render the refracted copy without nested `filter` /
  `backdrop-filter` (a "flat" variant); the visible page behind the lens can keep
  the full effects. Chromium is unaffected.

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
| `dome`          | —      | `0.4`   | 0…1          | Convex spherical-cap magnification of the body — the "liquid" middle. `0` = a flat window that only bends at the rim; `1` = a full hemisphere dome. |
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

## Examples

- **[`examples/demo`](./examples/demo)** — the runnable Vite + React app behind the
  [live demo](https://naturaldesignapp.github.io/openglass/): a draggable lens that
  refracts a backdrop, with a live material tuner. Run it locally:

  ```bash
  cd examples/demo
  bun install
  bun run dev
  ```

  Its [`src/GlassLens.tsx`](./examples/demo/src/GlassLens.tsx) is the clearest
  self-contained implementation of the host pattern.

- **[`examples/reference`](./examples/reference)** — the original editor hosts
  (`GlassLensDebug`, `CanvasNodeGlass`) OpenGlass was extracted from. Editor-coupled
  and not runnable standalone, kept as a reference for live-DOM clone sync, per-node
  glass, and the full WebKit handling.

The demo deploys to GitHub Pages automatically on push to `main`
(see [`.github/workflows/deploy-pages.yml`](./.github/workflows/deploy-pages.yml)).

---

## Roadmap

- ~~A batteries-included `<OpenGlass>` component that owns the host pattern.~~
  ✅ Shipped — see [Quick start (drop-in)](#quick-start-drop-in).
- More finished components built on `<OpenGlass>` (the [switch and
  slider](#components) are the first two).
- A WebGL renderer that consumes the same displacement map.

---

## License

[MIT](./LICENSE)
