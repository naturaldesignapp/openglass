import { useMemo } from 'react'
import { makeOpenGlassDisplacementMap, type OpenGlassMaterial } from './material'

export interface OpenGlassFilterProps {
  /**
   * Filter element id, referenced by the consumer as `filter: url(#id)`.
   * WebKit caches filter output by id — pass a fresh id to force a rebuild
   * (after drags, re-clones, or material changes).
   */
  id: string
  material: OpenGlassMaterial
  /**
   * Extra content (px) rendered around the pane and fed to the filter, so the
   * displacement near the rim samples real content instead of smearing the
   * edge. The filtered element must be `pane + 2*margin` per axis with the
   * pane centred, and must clip its painted source (`overflow: hidden`).
   */
  margin: number
  /**
   * A prebuilt displacement map (data URL) to use instead of the rounded-rect
   * map derived from `material`. Pass one from {@link makeOpenGlassShapeMap} to
   * refract along an arbitrary silhouette.
   */
  mapUrl?: string
}

/**
 * The SVG filter for an OpenGlass pane: displacement map + one displacement
 * pass (or three `screen`-blended passes when `chroma > 0`). Blur is not
 * applied here — see the OpenGlass docs for the cross-engine blur approach.
 *
 * Render once per pane; the host element points at it with
 * `filter: url(#id)`. See the OpenGlass docs for the cross-browser layout
 * rules the host must follow.
 */
export function OpenGlassFilter({ id, material, margin, mapUrl }: OpenGlassFilterProps) {
  const boxW = Math.round(material.width + margin * 2)
  const boxH = Math.round(material.height + margin * 2)
  const generatedMap = useMemo(
    () => (mapUrl ? '' : makeOpenGlassDisplacementMap(material, margin)),
    // Only shape/bevel parameters live in the map; the rest are filter attrs.
    [mapUrl, material.width, material.height, material.borderRadius, material.depth, material.curvature, material.splay, material.dome, margin],
  )
  const map = mapUrl || generatedMap
  const baseScale = material.scale * 2
  const chroma = material.chroma
  // NB: `material.blur` is intentionally NOT applied here. WebKit's feGaussianBlur
  // shifts its output by a fraction of the radius (its box-blur approximation),
  // which visibly offsets the refracted backdrop whether the blur runs before or
  // after the displacement. The host instead blurs the SOURCE DOM with a CSS
  // `filter: blur()` (positionally exact in every engine) before it reaches this
  // filter, so displacement here stays the only spatial op.

  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden>
      <filter
        id={id}
        x="0"
        y="0"
        width={boxW}
        height={boxH}
        filterUnits="userSpaceOnUse"
        primitiveUnits="userSpaceOnUse"
        colorInterpolationFilters="sRGB"
      >
        <feImage
          href={map}
          x="0"
          y="0"
          width={boxW}
          height={boxH}
          preserveAspectRatio="none"
          result="map"
        />
        {chroma > 0 ? (
          <>
            <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale * (1 + chroma)} xChannelSelector="R" yChannelSelector="G" result="dR" />
            <feColorMatrix in="dR" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cR" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale} xChannelSelector="R" yChannelSelector="G" result="dG" />
            <feColorMatrix in="dG" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="cG" />
            <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale * (1 - chroma)} xChannelSelector="R" yChannelSelector="G" result="dB" />
            <feColorMatrix in="dB" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="cB" />
            <feBlend in="cR" in2="cG" mode="screen" result="cRG" />
            <feBlend in="cRG" in2="cB" mode="screen" />
          </>
        ) : (
          <feDisplacementMap in="SourceGraphic" in2="map" scale={baseScale} xChannelSelector="R" yChannelSelector="G" />
        )}
      </filter>
    </svg>
  )
}
