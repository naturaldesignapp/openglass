import { useState } from 'react'
import { OpenGlassSlider, OpenGlassToggle } from 'openglass'

/** Opaque surface the lens refracts against — must match the panel fill. */
const PANEL_SURFACE = '#fafaf6'

function SettingRow({
  label,
  children,
  last,
}: {
  label: string
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        padding: '14px 0',
        borderBottom: last ? 'none' : '1px solid var(--nd-rule)',
      }}
    >
      <span style={{ fontSize: 15, color: 'var(--nd-text)' }}>{label}</span>
      {children}
    </div>
  )
}

export function ComponentsSection() {
  const [wifi, setWifi] = useState(true)
  const [bluetooth, setBluetooth] = useState(false)
  const [volume, setVolume] = useState(62)
  const [brightness, setBrightness] = useState(40)

  return (
    <section
      id="components"
      style={{
        padding: 'clamp(64px, 8vw, 112px) var(--nd-gutter)',
        background: 'var(--nd-panel-2)',
        borderTop: '1px solid var(--nd-rule)',
        borderBottom: '1px solid var(--nd-rule)',
      }}
    >
      <div style={{ marginBottom: 'clamp(28px, 4vw, 44px)' }}>
        <p className="nd-kicker">Components</p>
        <h2 className="nd-display" style={{ marginTop: 14, maxWidth: 620, fontSize: 'clamp(28px, 3.6vw, 46px)' }}>
          The lens, as controls.
        </h2>
        <p
          className="nd-measure"
          style={{ maxWidth: '48ch', marginTop: 14, color: 'var(--nd-muted)', fontSize: 15, lineHeight: 1.5 }}
        >
          The thumb and handle are OpenGlass lenses — each bends the track beneath it as it moves,
          in Chrome, Safari, and Firefox. Press, drag, or tap to expand the lens.
        </p>
      </div>

      {/* Mini settings panel — same canvas language as the hero mock. */}
      <div
        style={{
          maxWidth: 520,
          border: '1px solid #d6d6d0',
          borderRadius: 3,
          background: 'var(--nd-soft)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            height: 32,
            padding: '0 13px',
            background: '#ecece8',
            borderBottom: '1px solid #d0d0ca',
          }}
        >
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b8b8b2' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b8b8b2' }} />
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#b8b8b2' }} />
        </div>

        <div
          style={{
            padding: '6px 22px',
            background: PANEL_SURFACE,
          }}
        >
          <SettingRow label="Wi-Fi">
            <OpenGlassToggle
              checked={wifi}
              onCheckedChange={setWifi}
              surface={PANEL_SURFACE}
              trackColor="var(--nd-rule)"
              activeColor="var(--nd-accent)"
              aria-label="Wi-Fi"
              forceExpanded
            />
          </SettingRow>
          <SettingRow label="Bluetooth">
            <OpenGlassToggle
              checked={bluetooth}
              onCheckedChange={setBluetooth}
              surface={PANEL_SURFACE}
              trackColor="var(--nd-rule)"
              activeColor="var(--nd-accent)"
              aria-label="Bluetooth"
            />
          </SettingRow>
          <SettingRow label="Volume">
            <OpenGlassSlider
              value={volume}
              onValueChange={setVolume}
              width={200}
              surface={PANEL_SURFACE}
              trackColor="var(--nd-rule)"
              activeColor="var(--nd-accent)"
              aria-label="Volume"
            />
          </SettingRow>
          <SettingRow label="Brightness" last>
            <OpenGlassSlider
              value={brightness}
              onValueChange={setBrightness}
              width={200}
              surface={PANEL_SURFACE}
              trackColor="var(--nd-rule)"
              activeColor="#ffd60a"
              aria-label="Brightness"
            />
          </SettingRow>
        </div>
      </div>
    </section>
  )
}
