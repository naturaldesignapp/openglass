import type { CSSProperties } from 'react'

interface SliderProps {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}

/** A thin styled wrapper over a native range input, used by the tuner. The
 * filled portion of the track is driven by a `--fill` custom property. */
export function Slider({ value, min, max, onChange }: SliderProps) {
  const fill = max > min ? ((value - min) / (max - min)) * 100 : 0
  return (
    <input
      type="range"
      className="og-slider"
      value={value}
      min={min}
      max={max}
      // Fine-grained so decimal params (curvature, splay…) feel continuous.
      step={(max - min) / 1000 || 1}
      style={{ '--fill': `${fill}%` } as CSSProperties}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )
}
