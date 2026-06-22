import { useEffect, useRef, useState } from 'react'
import { openGlassOverlayStyle, type OpenGlassMaterial } from 'openglass'
import { CopyInstall } from './CopyInstall'
import { DESIGN_BEATS, ERA_FONT, GLASS_BEATS, MERGE_BEAT, type Beat } from './eras'

// Vertical scrollytelling. A pinned stage holds two columns that scroll their
// histories in parallel: glass (left, on paper) and design (right, on Natural
// Design blue). Glass starts at 80% of the width because, in antiquity, design
// barely exists; as you scroll the split eases toward 50/50 as design becomes a
// discipline. When the two meet, the stage releases and the OpenGlass close
// flows up beneath it as the final scroll.

const N = GLASS_BEATS.length // beats per column (the two tracks stay aligned)
const GLASS_START_PCT = 80
const GLASS_END_PCT = 50
const DESIGN_BLUE = '#0A21F5'

// Per-scroll travel: each beat gets ~82vh of scroll inside the pinned stage.
const STORY_VH = N * 82

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const beatWeight = (b: Beat) => (b.font === 'gothic' ? 700 : b.font === 'sans' ? 600 : 500)

// One vertical track of beats. Container queries size the type to the column's
// own width, so the narrow early column reads small and grows as it widens —
// the layout itself tells the story. `dark` flips the palette for the blue
// design panel.
function Track({
  beats,
  label,
  beatFloat,
  align,
  dark = false,
}: {
  beats: Beat[]
  label: string
  beatFloat: number
  align: 'left' | 'right'
  dark?: boolean
}) {
  const titleColor = dark ? '#ffffff' : '#0a0a0a'
  const bodyColor = dark ? 'rgba(255,255,255,0.82)' : 'rgba(8,9,10,0.66)'
  const labelColor = dark ? 'rgba(255,255,255,0.7)' : 'var(--nd-faint)'
  return (
    <div style={{ position: 'absolute', inset: 0, containerType: 'inline-size', overflow: 'hidden' }}>
      {/* Column label, pinned top. */}
      <div
        style={{
          position: 'absolute',
          top: 'calc(var(--nd-header-h) + 18px)',
          left: align === 'left' ? 'var(--nd-gutter)' : 'auto',
          right: align === 'right' ? 'var(--nd-gutter)' : 'auto',
          zIndex: 3,
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: labelColor,
        }}
      >
        {label}
      </div>

      {beats.map((beat, i) => {
        const offset = i - beatFloat
        const dist = Math.abs(offset)
        // On the blue panel the period accent colours would clash; use white.
        const yearColor = dark ? 'rgba(255,255,255,0.92)' : beat.accent
        return (
          <div
            key={beat.title}
            aria-hidden={dist > 0.5}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              padding: '0 clamp(20px, 4cqw, 64px)',
              textAlign: align,
              alignItems: align === 'left' ? 'flex-start' : 'flex-end',
              transform: `translate3d(0, ${offset * 48}vh, 0)`,
              opacity: clamp(1.32 - dist * 2.7, 0, 1),
              willChange: 'transform, opacity',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: yearColor, fontSize: 'clamp(11px, 1.4cqw, 14px)', fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
              <span style={{ width: 22, height: 1, background: yearColor, opacity: 0.6, order: align === 'right' ? 2 : 0 }} />
              <span>{beat.year}</span>
            </div>
            <h3
              className="nd-display"
              style={{
                fontFamily: ERA_FONT[beat.font],
                fontSize: 'clamp(30px, 11cqw, 92px)',
                lineHeight: 0.98,
                fontWeight: beatWeight(beat),
                letterSpacing: beat.upper ? '0.02em' : '-0.012em',
                textTransform: beat.upper ? 'uppercase' : 'none',
                color: titleColor,
              }}
            >
              {beat.title}
            </h3>
            <p
              style={{
                margin: '18px 0 0',
                maxWidth: '34ch',
                fontSize: 'clamp(13px, 3.4cqw, 17px)',
                lineHeight: 1.5,
                color: bodyColor,
              }}
            >
              {beat.body}
            </p>
          </div>
        )
      })}
    </div>
  )
}

const CLOSE_MATERIAL: OpenGlassMaterial = {
  width: 200,
  height: 200,
  borderRadius: 100,
  scale: 30,
  depth: 41,
  curvature: 2.8,
  splay: -1,
  chroma: 0.06,
  blur: 0,
  glow: 0.34,
  edgeHighlight: 0.6,
  specularAngle: 325,
}

// The synthesis, as a normal section that scrolls up beneath the pinned stage.
function OpenGlassClose() {
  return (
    <section
      style={{
        minHeight: '92vh',
        display: 'grid',
        placeItems: 'center',
        padding: 'clamp(72px, 12vh, 160px) var(--nd-gutter)',
        background: '#fff',
      }}
    >
      <div style={{ width: 'min(720px, 100%)', textAlign: 'center' }}>
        <div
          aria-hidden
          style={{
            width: CLOSE_MATERIAL.width,
            height: CLOSE_MATERIAL.height,
            margin: '0 auto 40px',
            ...openGlassOverlayStyle(CLOSE_MATERIAL),
            background: `radial-gradient(120% 120% at 30% 22%, rgba(10,33,245,0.32), rgba(233,219,255,0.2) 60%, rgba(255,255,255,0.08)), ${openGlassOverlayStyle(CLOSE_MATERIAL).background as string}`,
          }}
        />
        <p className="nd-kicker" style={{ color: DESIGN_BLUE }}>Where the two meet</p>
        <h2 className="nd-display" style={{ marginTop: 14, fontSize: 'clamp(48px, 9vw, 116px)', letterSpacing: '-0.02em' }}>
          {MERGE_BEAT.title}
        </h2>
        <p style={{ margin: '22px auto 0', maxWidth: '52ch', fontSize: 'clamp(15px, 1.8vw, 20px)', lineHeight: 1.5, color: 'var(--nd-muted)' }}>
          {MERGE_BEAT.body}
        </p>
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <CopyInstall variant="solid" />
        </div>
      </div>
    </section>
  )
}

function ProgressRail({ active }: { active: number }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 'clamp(20px, 4vh, 36px)',
        left: 'var(--nd-gutter)',
        zIndex: 5,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      {Array.from({ length: N }).map((_, i) => {
        const on = i === active
        return (
          <span
            key={i}
            style={{
              width: on ? 9 : 7,
              height: on ? 9 : 7,
              borderRadius: '50%',
              background: on ? '#0a0a0a' : 'rgba(8,9,10,0.18)',
              transition: 'background-color 200ms ease, width 200ms ease, height 200ms ease',
            }}
          />
        )
      })}
    </div>
  )
}

export function StoryStage() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [t, setT] = useState(0)

  // Scroll → progress, rAF-throttled. Imperative subscription, so an effect is
  // the right tool here.
  useEffect(() => {
    let raf = 0
    const update = () => {
      raf = 0
      const el = wrapperRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const span = rect.height - window.innerHeight
      setT(span > 0 ? clamp(-rect.top / span, 0, 1) : 0)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    update()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])

  const beatFloat = t * (N - 1)
  const glassW = lerp(GLASS_START_PCT, GLASS_END_PCT, t)
  const active = clamp(Math.round(beatFloat), 0, N - 1)

  return (
    <>
      <section id="story" ref={wrapperRef} style={{ position: 'relative', height: `${STORY_VH}vh` }}>
        <div style={{ position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', background: '#fff' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
            <div style={{ position: 'relative', width: `${glassW}%`, height: '100%', background: '#f6f8fb' }}>
              <Track beats={GLASS_BEATS} label="Glass" beatFloat={beatFloat} align="left" />
            </div>
            <div style={{ position: 'relative', width: `${100 - glassW}%`, height: '100%', background: DESIGN_BLUE }}>
              <Track beats={DESIGN_BEATS} label="Design" beatFloat={beatFloat} align="right" dark />
            </div>
          </div>

          <ProgressRail active={active} />
        </div>
      </section>

      <OpenGlassClose />
    </>
  )
}
