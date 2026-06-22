import type { SVGProps } from 'react'

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

/** Full "natural design" wordmark + hexagon mark. */
export function NaturalDesignWordmark(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 221 89" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <g transform="matrix(1,0,0,1,3889.33,2714.46)">
        <g transform="matrix(0.674081,0,0,0.674081,-3433.25,-2783.18)">
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
          <g transform="matrix(0.167239,0,0,0.167239,-683.848,-15.0228)">
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
