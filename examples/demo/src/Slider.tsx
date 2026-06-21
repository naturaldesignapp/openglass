interface SliderProps {
  value: number
  min: number
  max: number
  onChange: (next: number) => void
}

/** A thin styled wrapper over a native range input, used by the tuner. */
export function Slider({ value, min, max, onChange }: SliderProps) {
  return (
    <input
      type="range"
      className="og-slider"
      value={value}
      min={min}
      max={max}
      // Fine-grained so decimal params (curvature, splay…) feel continuous.
      step={(max - min) / 1000 || 1}
      onChange={(event) => onChange(Number(event.target.value))}
    />
  )
}
