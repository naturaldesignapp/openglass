import { useState } from 'react'
import { OPEN_GLASS_DEFAULTS, OPEN_GLASS_PARAMS, type OpenGlassMaterial } from 'openglass'
import { Slider } from './Slider'

interface GlassTunerProps {
  material: OpenGlassMaterial
  onChange: (next: OpenGlassMaterial) => void
}

/** Live material editor — one slider per OPEN_GLASS_PARAM. */
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
        position: 'fixed',
        left: '50%',
        bottom: 20,
        transform: 'translateX(-50%)',
        zIndex: 20,
        width: 640,
        maxWidth: 'calc(100vw - 32px)',
        padding: '12px 18px 16px',
        borderRadius: 16,
        background: 'var(--og-panel)',
        border: '1px solid var(--og-border)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        color: 'var(--og-text)',
        fontSize: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 600, letterSpacing: 0.2 }}>OpenGlass material</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="og-button" onClick={() => onChange(OPEN_GLASS_DEFAULTS)}>
            Reset
          </button>
          <button type="button" className="og-button" onClick={copyValues}>
            {copied ? 'Copied' : 'Copy values'}
          </button>
        </div>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          columnGap: 28,
          rowGap: 9,
        }}
      >
        {OPEN_GLASS_PARAMS.map((param) => {
          const value = material[param.key]
          const factor = 10 ** param.decimals
          return (
            <div
              key={param.key}
              style={{
                display: 'grid',
                gridTemplateColumns: '104px 1fr 44px',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <span style={{ color: 'var(--og-text-dim)', whiteSpace: 'nowrap' }}>{param.label}</span>
              <Slider
                value={value}
                min={param.min}
                max={param.max}
                onChange={(next) => onChange({ ...material, [param.key]: Math.round(next * factor) / factor })}
              />
              <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {value.toFixed(param.decimals)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
