import { useState } from 'react'

const INSTALL = 'npm install openglass'

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7.5L5.5 10.5L11.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CopyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3" y="3" width="8" height="8" rx="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3 8.5H1.9C1.4 8.5 1 8.1 1 7.6V1.9C1 1.4 1.4 1 1.9 1H7.6c.5 0 .9.4.9.9V3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  )
}

interface CopyInstallProps {
  /** 'solid' for the dark primary pill, 'ghost' for an outline pill. */
  variant?: 'solid' | 'ghost'
}

/** The package install command as a click-to-copy pill (tick + "Copied"). */
export function CopyInstall({ variant = 'solid' }: CopyInstallProps) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    void navigator.clipboard?.writeText(INSTALL)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied install command' : `Copy install command: ${INSTALL}`}
      className={`nd-pill ${variant === 'solid' ? 'nd-pill-solid' : ''}`}
      style={{
        gap: 9,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: 13.5,
        paddingInline: 16,
        ...(variant === 'ghost' ? { border: '1px solid var(--nd-hair)' } : null),
      }}
    >
      <span style={{ display: 'inline-flex', color: copied ? '#7ee787' : 'inherit' }}>
        {copied ? <CheckIcon /> : <CopyIcon />}
      </span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{copied ? 'Copied' : INSTALL}</span>
    </button>
  )
}
