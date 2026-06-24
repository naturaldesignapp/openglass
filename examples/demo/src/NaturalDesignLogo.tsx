import type { CSSProperties, SVGProps } from 'react'

// The Natural Design wordmark, ported verbatim from the ND marketing header so
// OpenGlass carries the parent brand exactly. Fills use `currentColor`, so
// colour and size come from the surrounding context.

const HEXAGON_PATH =
  'M168.319,537.859L213.136,563.734L213.136,615.485L168.319,641.36L123.502,615.485L123.502,563.734L168.319,537.859Z'
const STEM_PATH =
  'M168.319,357.71L213.136,333.734L213.136,605.485L168.319,631.36L123.502,605.485L123.502,333.734L168.319,357.71Z'
const LOWER_CAP_PATH =
  'M414.883,1354.59L459.701,1278.23L504.518,1354.59L459.701,1378.74L414.883,1354.59Z'

const LOGO_PIECES: readonly { transform: string; d: string }[] = [
  { transform: 'matrix(1,0,0,1,99.1303,801.627)', d: STEM_PATH },
  { transform: 'matrix(1,0,0,1,-192.251,-266.725)', d: LOWER_CAP_PATH },
  { transform: 'matrix(1,0,0,1,9.49602,523.861)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,188.765,523.861)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,-80.1383,472.111)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,278.399,472.111)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,9.49602,420.36)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,188.765,420.36)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,-80.1383,368.61)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,99.1303,368.61)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,278.399,368.61)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,9.49602,316.86)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,188.765,316.86)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,99.1303,265.109)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,9.49602,213.359)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,188.765,213.359)', d: HEXAGON_PATH },
  { transform: 'matrix(1,0,0,1,99.1303,161.609)', d: HEXAGON_PATH },
]

const MARK_VIEWBOX = '0 0 70 89'

const MARK_ROOT_TRANSFORM = 'matrix(1,0,0,1,3889.33,2714.46)'
const MARK_SCALE_TRANSFORM = 'matrix(0.674081,0,0,0.674081,-3433.25,-2783.18)'
const MARK_PIECES_TRANSFORM = 'matrix(0.167239,0,0,0.167239,-683.848,-15.0228)'

function MarkPaths({
  fill = 'currentColor',
  stroke,
  strokeWidth,
  className,
}: {
  fill?: string
  stroke?: string
  strokeWidth?: number
  className?: string
}) {
  return (
    <g transform={MARK_ROOT_TRANSFORM}>
      <g transform={MARK_SCALE_TRANSFORM}>
        <g transform={MARK_PIECES_TRANSFORM}>
          {LOGO_PIECES.map((piece, index) => (
            <path
              key={`${piece.transform}-${index}`}
              className={className}
              d={piece.d}
              fill={fill}
              stroke={stroke}
              strokeWidth={strokeWidth}
              transform={piece.transform}
              style={className ? { animationDelay: `${index * 48}ms` } : undefined}
            />
          ))}
        </g>
      </g>
    </g>
  )
}

/** Hexagon mark from the Natural Design wordmark. */
export function NaturalDesignMark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox={MARK_VIEWBOX} focusable="false" xmlns="http://www.w3.org/2000/svg">
      <MarkPaths className="nd-brand-piece" />
    </svg>
  )
}

// The mark silhouette as a standalone SVG markup string (white fill), for use
// as a CSS `mask-image` data URL. We mask via a data URL rather than referencing
// an inline `<mask>`/`<clipPath>` because that is the only silhouette technique
// that works for HTML elements across Chromium, Gecko, and WebKit: WebKit drops
// `mask: url(#id)`, and `<clipPath>` forbids the grouped transforms this mark
// needs.
const MARK_MASK_BODY =
  `<g transform='${MARK_ROOT_TRANSFORM}'><g transform='${MARK_SCALE_TRANSFORM}'>` +
  `<g transform='${MARK_PIECES_TRANSFORM}'>` +
  LOGO_PIECES.map((p) => `<path d='${p.d}' transform='${p.transform}' fill='#fff'/>`).join('') +
  `</g></g></g>`

const MARK_MASK_SVG = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${MARK_VIEWBOX}'>${MARK_MASK_BODY}</svg>`

const MARK_MASK_URL = `url("data:image/svg+xml,${encodeURIComponent(MARK_MASK_SVG)}")`

function applyMatrix(ctx: CanvasRenderingContext2D, matrix: string): void {
  const [a, b, c, d, e, f] = matrix
    .slice(matrix.indexOf('(') + 1, matrix.indexOf(')'))
    .split(',')
    .map(Number)
  ctx.transform(a, b, c, d, e, f)
}

/**
 * Paints the mark silhouette into a 2D context, scaled so the 70×89 mark fills
 * `width`×`height` in the context's current units. For {@link makeOpenGlassShapeMap}.
 */
export function drawMarkSilhouette(ctx: CanvasRenderingContext2D, width: number, height: number): void {
  ctx.save()
  ctx.scale(width / 70, height / 89)
  applyMatrix(ctx, MARK_ROOT_TRANSFORM)
  applyMatrix(ctx, MARK_SCALE_TRANSFORM)
  applyMatrix(ctx, MARK_PIECES_TRANSFORM)
  for (const piece of LOGO_PIECES) {
    ctx.save()
    applyMatrix(ctx, piece.transform)
    ctx.fill(new Path2D(piece.d))
    ctx.restore()
  }
  ctx.restore()
}

/** Light stroke frame so the glass mark reads on white. */
export function GlassMarkOutline({
  width,
  height,
  style,
}: {
  width: number
  height: number
  style?: CSSProperties
}) {
  return (
    <svg
      aria-hidden
      width={width}
      height={height}
      viewBox={MARK_VIEWBOX}
      focusable="false"
      xmlns="http://www.w3.org/2000/svg"
      style={style}
    >
      <MarkPaths fill="none" stroke="rgba(0,0,0,0.14)" strokeWidth={1.1} />
    </svg>
  )
}

/** Drop shadow that follows the mark silhouette. */
export function glassMarkShadowStyle(): CSSProperties {
  const shadow = [
    'drop-shadow(0 10px 28px rgba(0,0,0,0.11))',
    'drop-shadow(0 3px 10px rgba(0,0,0,0.07))',
  ].join(' ')
  return { filter: shadow, WebkitFilter: shadow }
}

/**
 * CSS that masks an element to the Natural Design mark silhouette, sized to
 * `material` and offset by (`offsetX`, `offsetY`). Spread onto the filtered box
 * (offset by `margin`) and the pane overlay (offset 0).
 */
export function glassMarkMaskStyle(
  material: { width: number; height: number },
  offsetX: number,
  offsetY: number,
): CSSProperties {
  const size = `${material.width}px ${material.height}px`
  const position = `${offsetX}px ${offsetY}px`
  return {
    maskImage: MARK_MASK_URL,
    WebkitMaskImage: MARK_MASK_URL,
    maskRepeat: 'no-repeat',
    WebkitMaskRepeat: 'no-repeat',
    maskSize: size,
    WebkitMaskSize: size,
    maskPosition: position,
    WebkitMaskPosition: position,
  }
}

/** Full "natural design" wordmark + hexagon mark. */
export function NaturalDesignWordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 221 89" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <g transform={MARK_ROOT_TRANSFORM}>
        <g transform={MARK_SCALE_TRANSFORM}>
          <g transform="matrix(0.795811,0,0,0.795811,-876.612,-398.96)">
            <text x="369.103px" y="703.268px" fill="currentColor" style={{ fontFamily: 'var(--font-sans)', fontSize: '94.178px', fontWeight: 500 }}>
              n
              <tspan x="421.749px 471.286px 503.401px 556.423px 590.421px 644.667px" y="703.268px 703.268px 703.268px 703.268px 703.268px 703.268px">
                atural
              </tspan>
            </text>
          </g>
          <g transform="matrix(0.795811,0,0,0.795811,-878.074,-340.981)">
            <text x="369.103px" y="703.268px" fill="currentColor" style={{ fontFamily: 'var(--font-sans)', fontSize: '94.178px', fontWeight: 500 }}>
              de
              <tspan x="484.659px 537.493px 560.284px 614.436px" y="703.268px 703.268px 703.268px 703.268px">
                sign
              </tspan>
            </text>
          </g>
          <g transform={MARK_PIECES_TRANSFORM}>
            {LOGO_PIECES.map((piece, index) => (
              <path
                key={`${piece.transform}-${index}`}
                className="nd-brand-piece"
                d={piece.d}
                fill="currentColor"
                transform={piece.transform}
                style={{ animationDelay: `${index * 48}ms` }}
              />
            ))}
          </g>
        </g>
      </g>
    </svg>
  )
}
