import { CopyInstall } from './CopyInstall'

// A four-stage pipeline, in the order the pixels actually flow. Numbers earn
// their place here because it is a real sequence.
const STEPS = [
  {
    n: '01',
    title: 'Bake a height field',
    body: 'For each pane we render a displacement map on a canvas: a flat 128/128 field with a rounded-rect pane stamped in. Inside a band of `depth` px measured from the edge, the red and green channels store how far that pixel should pull along the surface normal, ramping from the rim with a `(1 − d/depth)^curvature` falloff. `splay` sets the sign: −1 pinches the rim and magnifies the centre, +1 bulges out. The field is 4-fold symmetric, so only one quadrant is computed and mirrored with sign flips.',
  },
  {
    n: '02',
    title: 'Displace the source',
    body: 'The map is handed to an SVG `<feImage>`, then `<feDisplacementMap in="SourceGraphic" in2="map">` walks every output pixel and resamples the content behind the pane, offset by `((R−128)/127, (G−128)/127) × scale`, with `scale = material.scale × 2`. Flat interiors map to 128/128 and stay put; only the bevel band bends, so straight lines refract at the rim exactly like real ground glass.',
  },
  {
    n: '03',
    title: 'Split the colour',
    body: 'Real glass disperses wavelengths. With `chroma > 0` the filter runs three displacement passes at `scale × (1 + chroma)`, `scale`, and `scale × (1 − chroma)`, isolates one of R/G/B from each with an `feColorMatrix`, and recombines them with `screen` blends. The result is a faint red/blue fringe at the rim, strongest where the bend is steepest.',
  },
  {
    n: '04',
    title: 'Light the edge in CSS',
    body: 'The shine never touches the filter. A separate, unfiltered layer (`openGlassOverlayStyle`) paints a concentric rim ring scaled by `edgeHighlight`, a directional specular hotspot placed from `specularAngle`, and inset/drop shadows that read as thickness. It is plain `background` and `box-shadow`, so it composites over the refracted content on any element.',
  },
]

export function MaterialSection() {
  return (
    <section
      id="material"
      style={{
        padding: 'clamp(64px, 8vw, 112px) var(--nd-gutter)',
        background: 'var(--nd-panel-2)',
        borderTop: '1px solid var(--nd-rule)',
        borderBottom: '1px solid var(--nd-rule)',
      }}
    >
      <p className="nd-kicker">How it works</p>
      <h2 className="nd-display" style={{ marginTop: 14, maxWidth: 880, fontSize: 'clamp(28px, 3.6vw, 46px)' }}>
        Refraction is a height field, a displacement map, and one CSS overlay.
      </h2>
      <p className="nd-measure" style={{ marginTop: 18, maxWidth: '66ch', color: 'var(--nd-muted)', fontSize: 'clamp(15px, 1.5vw, 18px)', lineHeight: 1.55 }}>
        OpenGlass never traces rays. It approximates a thin lens by precomputing
        where light would land, encoding that as an image, and letting the
        browser&rsquo;s own filter engine push pixels around. Four stages, in the
        order they run.
      </p>

      <ol className="og-steps">
        {STEPS.map((step) => (
          <li key={step.n} style={{ padding: 'clamp(22px, 2.6vw, 34px)', background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--nd-accent)', fontSize: 14, fontWeight: 600 }}>{step.n}</span>
              <h3 className="nd-display" style={{ margin: 0, fontSize: 'clamp(19px, 1.8vw, 24px)', lineHeight: 1.15 }}>
                {step.title}
              </h3>
            </div>
            <p style={{ margin: 0, maxWidth: '54ch', color: '#4f4f49', fontSize: 14.5, lineHeight: 1.6 }}>
              {renderWithCode(step.body)}
            </p>
          </li>
        ))}
      </ol>

      <div style={{ marginTop: 28, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }}>
        <CopyInstall variant="ghost" />
        <span style={{ color: 'var(--nd-faint)', fontSize: 14 }}>
          The map is a data URL and the overlay is plain CSS, so the same material drops into any host you compose. Zero dependencies.
        </span>
      </div>
    </section>
  )
}

// Render `inline code` spans (backtick-delimited) as monospace without a
// markdown dependency.
function renderWithCode(text: string) {
  return text.split('`').map((part, i) =>
    i % 2 === 1 ? (
      <code
        key={i}
        style={{
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: '0.92em',
          color: 'var(--nd-ink)',
          background: 'var(--nd-panel)',
          padding: '1px 5px',
          borderRadius: 4,
        }}
      >
        {part}
      </code>
    ) : (
      part
    ),
  )
}
