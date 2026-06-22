import { useState } from 'react'
import { OPEN_GLASS_DEFAULTS, OPEN_GLASS_PARAMS, type OpenGlassMaterial } from 'openglass'
import { Slider } from './Slider'

interface GlassTunerProps {
  material: OpenGlassMaterial
  onChange: (next: OpenGlassMaterial) => void
}

/** Live material editor — one slider per OPEN_GLASS_PARAM. ND card styling. */
export function GlassTuner({ material, onChange }: GlassTunerProps) {
  const [copied, setCopied] = useState(false)

  const copyValues = () => {
    void navigator.clipboard?.writeText(JSON.stringify(material, null, 2))
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1200)
  }

  return (
    <div
      style={{
        padding: 22,
        borderRadius: 12,
        background: '#fff',
        border: '1px solid var(--nd-hair)',
        color: 'var(--nd-ink)',
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 500 }}>Material</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="og-button" onClick={() => onChange(OPEN_GLASS_DEFAULTS)}>
            Reset
          </button>
          <button type="button" className="og-button" onClick={copyValues}>
            {copied ? 'Copied' : 'Copy values'}
          </button>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', columnGap: 22, rowGap: 16 }}>
        {OPEN_GLASS_PARAMS.map((param) => {
          const value = material[param.key]
          const factor = 10 ** param.decimals
          return (
            <div key={param.key} style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ color: 'var(--nd-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{param.label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--nd-ink)', fontWeight: 500 }}>
                  {value.toFixed(param.decimals)}
                </span>
              </div>
              <Slider
                value={value}
                min={param.min}
                max={param.max}
                onChange={(next) => onChange({ ...material, [param.key]: Math.round(next * factor) / factor })}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
