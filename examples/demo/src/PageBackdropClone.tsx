import { useEffect, useRef } from 'react'
import { isWebKitEngine } from 'openglass'

const IS_WEBKIT = isWebKitEngine()
const ROOT_ID = 'root'

/** Strip nested OpenGlass filters from a clone — duplicated ids break WebKit. */
function flattenClone(node: ParentNode) {
  node.querySelectorAll('svg').forEach((svg) => {
    const w = svg.getAttribute('width')
    const h = svg.getAttribute('height')
    if (w === '0' || h === '0') svg.remove()
  })
  node.querySelectorAll<HTMLElement>('[data-og-lens]').forEach((el) => el.remove())
  node.querySelectorAll<HTMLElement>('*').forEach((el) => {
    const style = el.style
    if (style.filter) {
      style.filter = 'none'
      style.webkitFilter = 'none'
    }
    if (style.backdropFilter) style.backdropFilter = 'none'
  })
}

interface PageBackdropCloneProps {
  /** Called when the clone is rebuilt (WebKit filter refresh). */
  onReclone?: () => void
}

/**
 * Live DOM clone of `#root`, positioned each frame so it lines up with the
 * real page under a fixed OpenGlass lens. The lens scene sits at viewport
 * origin; this host tracks `#root`'s getBoundingClientRect().
 */
export function PageBackdropClone({ onReclone }: PageBackdropCloneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.getElementById(ROOT_ID)
    const wrapper = wrapperRef.current
    if (!root || !wrapper) return

    let recloneTimer: number | null = null
    const reclone = () => {
      recloneTimer = null
      const fragment = document.createDocumentFragment()
      for (const child of Array.from(root.childNodes)) {
        fragment.appendChild(child.cloneNode(true))
      }
      flattenClone(fragment)
      wrapper.replaceChildren(fragment)
      onReclone?.()
    }

    const observer = new MutationObserver(() => {
      if (recloneTimer == null) recloneTimer = window.setTimeout(reclone, 150)
    })
    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true })
    reclone()

    let raf = 0
    let lastLeft = ''
    let lastTop = ''
    let lastWidth = ''
    let lastHeight = ''

    const tick = () => {
      const host = hostRef.current
      const liveRoot = document.getElementById(ROOT_ID)
      if (host && liveRoot) {
        const rect = liveRoot.getBoundingClientRect()
        const left = `${rect.left}px`
        const top = `${rect.top}px`
        const width = `${liveRoot.offsetWidth}px`
        const height = `${liveRoot.offsetHeight}px`
        if (left !== lastLeft) {
          host.style.left = left
          lastLeft = left
        }
        if (top !== lastTop) {
          host.style.top = top
          lastTop = top
        }
        if (width !== lastWidth) {
          host.style.width = width
          lastWidth = width
        }
        if (height !== lastHeight) {
          host.style.height = height
          lastHeight = height
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      observer.disconnect()
      if (recloneTimer != null) window.clearTimeout(recloneTimer)
      cancelAnimationFrame(raf)
    }
  }, [onReclone])

  return (
    <div
      ref={hostRef}
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        overflow: 'visible',
        pointerEvents: 'none',
      }}
    >
      <div ref={wrapperRef} style={{ position: 'relative', width: '100%', height: '100%' }} />
    </div>
  )
}

/** Page background colour for the rim bleed behind the clone. */
export function pageBackdropColor(): string {
  if (typeof document === 'undefined') return '#ffffff'
  const body = getComputedStyle(document.body)
  const html = getComputedStyle(document.documentElement)
  const bg = body.backgroundColor !== 'rgba(0, 0, 0, 0)' ? body.backgroundColor : html.backgroundColor
  return bg && bg !== 'rgba(0, 0, 0, 0)' ? bg : '#ffffff'
}

/** Whether WebKit needs an epoch bump after reclones. */
export const pageBackdropIsWebKit = IS_WEBKIT
