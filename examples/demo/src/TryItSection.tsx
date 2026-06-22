import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { OPEN_GLASS_DEFAULTS, isWebKitEngine, type OpenGlassMaterial } from 'openglass'
import { GlassTuner } from './GlassTuner'
import { RefractingLens } from './RefractingLens'

const IS_WEBKIT = isWebKitEngine()
const MARGIN = 48
const BASE = import.meta.env.BASE_URL

// The four works the lens refracts. Switchable by the 1–4 buttons on the left.
const IMAGES = [
  { src: `${BASE}monet.jpg`, title: 'Houses of Parliament', meta: 'Claude Monet, 1903' },
  { src: `${BASE}tangier.jpg`, title: 'Study for a Portrait', meta: 'Francis Bacon' },
  { src: `${BASE}design-is-the-art.png`, title: 'Design is the art', meta: 'of function and form fused' },
  { src: `${BASE}flowers.jpg`, title: 'Flowers', meta: 'still life' },
]

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/** The scene the lens refracts: a single artwork filling the stage. */
function ImageScene({ src }: { src: string }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', userSelect: 'none' }}
    />
  )
}

export function TryItSection() {
  const [material, setMaterial] = useState<OpenGlassMaterial>(OPEN_GLASS_DEFAULTS)
  const [imageIndex, setImageIndex] = useState(0)
  const stageRef = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const [pane, setPane] = useState({ x: 40, y: 40 })
  const [epoch, setEpoch] = useState(0)
  const didCenter = useRef(false)

  // Track the stage size; centre the pane once on the first real measurement.
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setBox({ w: rect.width, h: rect.height })
      if (!didCenter.current && rect.width > 0) {
        didCenter.current = true
        setPane({ x: (rect.width - material.width) / 2, y: (rect.height - material.height) / 2 })
      }
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
    // material.width is read once for the initial centre; intentionally not a dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filterId = useMemo(
    () => `og-try-${epoch}`,
    [material.width, material.height, material.borderRadius, material.depth, material.curvature, material.splay, epoch],
  )

  const maxX = Math.max(0, box.w - material.width)
  const maxY = Math.max(0, box.h - material.height)
  const paneX = clamp(pane.x, 0, maxX)
  const paneY = clamp(pane.y, 0, maxY)
  const posRef = useRef({ x: paneX, y: paneY })
  posRef.current = { x: paneX, y: paneY }

  const current = IMAGES[imageIndex]

  const pickImage = (i: number) => {
    setImageIndex(i)
    if (IS_WEBKIT) setEpoch((e) => e + 1)
  }

  const onDragPointerDown = (event: ReactPointerEvent) => {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const origin = posRef.current
    const dragMaxX = Math.max(0, box.w - material.width)
    const dragMaxY = Math.max(0, box.h - material.height)
    const onMove = (move: globalThis.PointerEvent) => {
      setPane({
        x: clamp(origin.x + (move.clientX - startX), 0, dragMaxX),
        y: clamp(origin.y + (move.clientY - startY), 0, dragMaxY),
      })
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (IS_WEBKIT) setEpoch((e) => e + 1)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const ready = box.w > 0 && box.h > 0

  return (
    <section id="try" style={{ padding: 'clamp(64px, 8vw, 112px) var(--nd-gutter)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20, marginBottom: 'clamp(28px, 4vw, 44px)' }}>
        <div>
          <p className="nd-kicker">Try it</p>
          <h2 className="nd-display" style={{ marginTop: 14, maxWidth: 620, fontSize: 'clamp(28px, 3.6vw, 46px)' }}>
            Drag the lens. Tune the glass.
          </h2>
        </div>
        <p className="nd-measure" style={{ maxWidth: '38ch', margin: 0, color: 'var(--nd-muted)', fontSize: 15, lineHeight: 1.5 }}>
          Switch the artwork with the numbers, drag the lens across it, and every
          control maps to a field on the same material object you pass in code.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) minmax(360px, 440px)', gap: 'clamp(16px, 2.4vw, 32px)', alignItems: 'start' }}>
        {/* Image picker rail. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} role="group" aria-label="Choose artwork">
          {IMAGES.map((img, i) => (
            <button
              key={img.src}
              type="button"
              className="og-num"
              aria-pressed={i === imageIndex}
              aria-label={`Show ${img.title}`}
              onClick={() => pickImage(i)}
            >
              {i + 1}
            </button>
          ))}
        </div>

        {/* Stage. */}
        <div>
          <div
            ref={stageRef}
            style={{
              position: 'relative',
              height: 'clamp(440px, 64vh, 660px)',
              overflow: 'hidden',
              borderRadius: 10,
              border: '1px solid var(--nd-hair)',
              background: '#0b0b0d',
              touchAction: 'none',
            }}
          >
            <ImageScene src={current.src} />
            {ready ? (
              <RefractingLens
                material={material}
                margin={MARGIN}
                filterId={filterId}
                winX={paneX - MARGIN}
                winY={paneY - MARGIN}
                sceneWidth={box.w}
                sceneHeight={box.h}
                baseColor="#0b0b0d"
                renderScene={() => <ImageScene src={current.src} />}
                invalidateKey={`${imageIndex},${Math.round(paneX)},${Math.round(paneY)},${material.width},${material.scale},${material.chroma}`}
                zIndex={10}
                overlayStyle={{ cursor: 'grab', touchAction: 'none' }}
                onOverlayPointerDown={onDragPointerDown}
              />
            ) : null}
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'baseline', gap: 10, color: 'var(--nd-muted)', fontSize: 13 }}>
            <span style={{ color: 'var(--nd-ink)', fontWeight: 500 }}>{current.title}</span>
            <span>{current.meta}</span>
          </div>
        </div>

        <GlassTuner material={material} onChange={setMaterial} />
      </div>
    </section>
  )
}
