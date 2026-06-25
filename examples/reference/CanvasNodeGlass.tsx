// ---------------------------------------------------------------------------
// REFERENCE ONLY — not part of the runnable build.
//
// The original editor host that binds an OpenGlass "shader" to a scene node and
// renders it inside the stage. It is coupled to the editor (clones `.nd-stage`,
// imports `@naturaldesign/core` and `../editor/scene-graph`), so it will NOT
// compile or run standalone. Kept here as a reference for the per-node host
// pattern (in-stage rendering, backdrop pruning, polygon/ellipse clips).
//
// For a self-contained, runnable lens see `examples/demo/src/RefractingLens.tsx`.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  OpenGlassFilter,
  isWebKitEngine,
  openGlassOverlayStyle,
  openGlassRadius,
  type OpenGlassMaterial,
} from 'openglass'
import { normalizePolygonSides, regularPolygonPointString } from '@naturaldesign/core'
import type { SceneNode } from '../editor/scene-graph'

// ---------------------------------------------------------------------------
// OpenGlass "shader" bound to a scene node, rendered INSIDE the stage.
//
// It's an absolutely-positioned sibling rendered right after the node, so it
// inherits the node's place in the paint order: nodes above it in the layer
// stack paint over it, transform handles (in the screen overlay) and panels
// stay on top, and the whole thing pans/zooms with the stage transform — no
// body portal, so it behaves identically in Tauri WebKit and Chromium.
//
// It refracts only what's behind the node: a live clone of `.nd-stage` with
// the glass node, everything painted on top of it, and all other glass layers
// pruned away, then bent by the OpenGlass displacement filter. Everything is
// in world units; the stage transform scales it to screen.
// ---------------------------------------------------------------------------

const IS_WEBKIT = isWebKitEngine()

/** Extra backdrop (world px) fed to the filter around the pane so the rim
 * samples real content instead of smearing the edge. */
const MARGIN = 64

function makeFilterId(): string {
  return `node-glass-${Math.random().toString(36).slice(2)}`
}

type Shape = 'rect' | 'ellipse' | 'polygon'

function shapeForNode(node: SceneNode): Shape {
  if (node.type === 'circle') return 'ellipse'
  if (node.type === 'polygon') return 'polygon'
  return 'rect'
}

/** clip-path cutting the pane shape out of the boxW×boxH glass layer (pane
 * centred, inset by MARGIN on every side). All values in world units. */
function paneClipPath(shape: Shape, node: SceneNode, paneW: number, paneH: number, radius: number): string {
  if (shape === 'ellipse') {
    return `ellipse(${paneW / 2}px ${paneH / 2}px at 50% 50%)`
  }
  if (shape === 'polygon') {
    const points = regularPolygonPointString(normalizePolygonSides(node.polygonSides), paneW, paneH, 0)
    const pts = points
      .split(' ')
      .map((pair) => {
        const [px, py] = pair.split(',')
        return `${Number(px) + MARGIN}px ${Number(py) + MARGIN}px`
      })
      .join(', ')
    return `polygon(${pts})`
  }
  return `inset(${MARGIN}px round ${radius}px)`
}

interface CanvasNodeGlassProps {
  node: SceneNode
  zoom: number
}

export function CanvasNodeGlass({ node, zoom }: CanvasNodeGlassProps) {
  const glass = node.glass

  const rootRef = useRef<HTMLDivElement>(null)
  const filteredRef = useRef<HTMLDivElement>(null)
  const cloneWrapperRef = useRef<HTMLDivElement>(null)
  const zoomRef = useRef(zoom)
  zoomRef.current = zoom

  const shape = shapeForNode(node)
  const paneW = Math.max(1, node.width)
  const paneH = Math.max(1, node.height)
  const cornerRadius = shape === 'ellipse'
    ? Math.min(paneW, paneH) / 2
    : shape === 'polygon'
      ? 0
      : Math.max(0, node.cornerRadius)

  // World units throughout — the stage transform handles zoom, so the material
  // is zoom-independent and the filter isn't rebuilt while zooming.
  const material: OpenGlassMaterial = useMemo(
    () => ({
      width: paneW,
      height: paneH,
      borderRadius: cornerRadius,
      scale: glass?.scale ?? 0,
      depth: glass?.depth ?? 1,
      curvature: glass?.curvature ?? 1,
      splay: glass?.splay ?? 0,
      dome: glass?.dome ?? OPEN_GLASS_DEFAULTS.dome,
      bodyZoom: glass?.bodyZoom ?? glass?.dome ?? OPEN_GLASS_DEFAULTS.bodyZoom,
      chroma: glass?.chroma ?? 0,
      blur: glass?.blur ?? 0,
      glow: glass?.glow ?? 0,
      edgeHighlight: glass?.edgeHighlight ?? 0,
      specularAngle: glass?.specularAngle ?? 0,
    }),
    [paneW, paneH, cornerRadius, glass?.scale, glass?.depth, glass?.curvature, glass?.splay, glass?.dome, glass?.bodyZoom, glass?.chroma, glass?.blur, glass?.glow, glass?.edgeHighlight, glass?.specularAngle],
  )

  const boxW = Math.round(material.width + MARGIN * 2)
  const boxH = Math.round(material.height + MARGIN * 2)
  const paneRadius = openGlassRadius(material)
  const clip = paneClipPath(shape, node, paneW, paneH, paneRadius)

  // WebKit caches filter output by id and drops/freezes it after re-clones or
  // material changes; a fresh id forces a rebuild.
  const [webkitEpoch, setWebkitEpoch] = useState(0)
  const filterId = useMemo(
    () => makeFilterId(),
    [material.width, material.height, material.borderRadius, material.depth, material.curvature, material.splay, webkitEpoch],
  )

  useEffect(() => {
    const stage = document.querySelector('.nd-stage') as HTMLElement | null
    const root = rootRef.current
    const cloneWrapper = cloneWrapperRef.current
    const filtered = filteredRef.current
    if (!stage || !root || !cloneWrapper || !filtered) return

    const nodeId = node.id

    let recloneTimer: number | null = null
    const reclone = () => {
      recloneTimer = null
      const fragment = document.createDocumentFragment()
      for (const child of Array.from(stage.children)) {
        fragment.appendChild(child.cloneNode(true))
      }
      // Drop every glass layer so we never refract glass-in-glass (and never
      // clone our own clone subtree — that would recurse).
      for (const layer of Array.from(fragment.querySelectorAll('.nd-node-glass'))) {
        layer.remove()
      }
      // Prune the glass node and everything painted on top of it (later in
      // document order at every ancestor level), leaving only the backdrop.
      const self = fragment.querySelector(`[data-shape-id="${nodeId}"]`)
      if (self) {
        let cur: Node = self
        while (cur.parentNode) {
          const parent: ParentNode = cur.parentNode
          let sib: ChildNode | null = cur.nextSibling
          while (sib) {
            const next: ChildNode | null = sib.nextSibling
            parent.removeChild(sib)
            sib = next
          }
          if (parent === fragment) break
          cur = parent as Node
        }
        self.parentNode?.removeChild(self)
      }
      cloneWrapper.replaceChildren(fragment)
      if (IS_WEBKIT) setWebkitEpoch((epoch) => epoch + 1)
    }

    const observer = new MutationObserver((mutations) => {
      // Ignore the stage's own transform changes (pan/zoom) and any writes
      // inside a glass layer (our own clone updates) — only real content
      // changes should trigger a re-clone.
      const contentChanged = mutations.some((mutation) => {
        if (mutation.type === 'attributes' && mutation.target === stage) return false
        const target = mutation.target as Node
        const el = target.nodeType === 1 ? (target as Element) : target.parentElement
        if (el?.closest('.nd-node-glass')) return false
        return true
      })
      if (contentChanged && recloneTimer == null) {
        recloneTimer = window.setTimeout(reclone, 120)
      }
    })
    observer.observe(stage, { childList: true, subtree: true, attributes: true, characterData: true })
    reclone()

    let rafId = 0
    let lastLeft = ''
    let lastTop = ''
    let lastCloneLeft = ''
    let lastCloneTop = ''
    let lastBackground = ''
    let nudgeToggle = false
    let nodeEl: HTMLElement | null = null
    // WebKit runs feDisplacementMap on the CPU, and every opacity nudge forces a
    // full filter re-render. Cap that to ~30fps and always service a pending
    // nudge once the interval elapses, so the resting frame is still refreshed
    // (identical steady-state output) while motion costs half the filter passes.
    const NUDGE_INTERVAL_MS = 1000 / 30
    let pendingNudge = false
    let lastNudgeAt = 0
    // Reading the page surface colour is a forced style flush; it changes only on
    // theme/page-colour edits, so poll it a few times a second instead of every
    // frame. The first frame still reads immediately (lastBgReadAt = 0).
    const BG_READ_INTERVAL_MS = 200
    let lastBgReadAt = 0
    const pageSurface = (stage.parentElement?.querySelector('.nd-page-color-surface') as HTMLElement | null) ?? null
    const tick = (now: number) => {
      if (!nodeEl || !nodeEl.isConnected) {
        nodeEl = stage.querySelector(`[data-shape-id="${nodeId}"]`)
      }
      const op = root.offsetParent as HTMLElement | null
      if (nodeEl && op) {
        const z = zoomRef.current || 1
        const nrect = nodeEl.getBoundingClientRect()
        const stageRect = stage.getBoundingClientRect()
        const opRect = op.getBoundingClientRect()
        let changed = false

        // Place the glass layer over the node (local to the shared offset
        // parent). Pan/zoom invariant — only changes when the node moves.
        const localX = (nrect.left - opRect.left) / z
        const localY = (nrect.top - opRect.top) / z
        const left = `${localX - MARGIN}px`
        const top = `${localY - MARGIN}px`
        if (left !== lastLeft) { root.style.left = left; lastLeft = left; changed = true }
        if (top !== lastTop) { root.style.top = top; lastTop = top; changed = true }

        // Align the backdrop clone to stage world coordinates.
        const worldX = (nrect.left - stageRect.left) / z
        const worldY = (nrect.top - stageRect.top) / z
        const cloneLeft = `${MARGIN - worldX}px`
        const cloneTop = `${MARGIN - worldY}px`
        if (cloneLeft !== lastCloneLeft) { cloneWrapper.style.left = cloneLeft; lastCloneLeft = cloneLeft; changed = true }
        if (cloneTop !== lastCloneTop) { cloneWrapper.style.top = cloneTop; lastCloneTop = cloneTop; changed = true }

        if (pageSurface && now - lastBgReadAt >= BG_READ_INTERVAL_MS) {
          lastBgReadAt = now
          const background = getComputedStyle(pageSurface).backgroundColor
          if (background !== lastBackground) { filtered.style.background = background; lastBackground = background; changed = true }
        }
        if (IS_WEBKIT) {
          if (changed) pendingNudge = true
          if (pendingNudge && now - lastNudgeAt >= NUDGE_INTERVAL_MS) {
            nudgeToggle = !nudgeToggle
            filtered.style.opacity = nudgeToggle ? '0.9999' : '1'
            lastNudgeAt = now
            pendingNudge = false
          }
        }
      }
      rafId = requestAnimationFrame(tick)
    }
    rafId = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(rafId)
      observer.disconnect()
      if (recloneTimer != null) window.clearTimeout(recloneTimer)
    }
  }, [node.id])

  if (!glass) return null

  const overlayStyle = openGlassOverlayStyle(material)
  if (shape === 'ellipse') overlayStyle.borderRadius = '50%'
  if (shape === 'polygon') {
    overlayStyle.borderRadius = 0
    const poly = paneClipPath('polygon', node, paneW, paneH, 0).replace(
      /(\d+(?:\.\d+)?)px (\d+(?:\.\d+)?)px/g,
      (_m, px: string, py: string) => `${Number(px) - MARGIN}px ${Number(py) - MARGIN}px`,
    )
    overlayStyle.clipPath = poly
    overlayStyle.WebkitClipPath = poly
  }

  return (
    <div
      ref={rootRef}
      className="nd-node-glass"
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: boxW,
        height: boxH,
        pointerEvents: 'none',
        // Cut the pane shape on this PARENT, keeping clip-path off the filtered
        // element (WebKit freezes a clip-path+filter layer).
        clipPath: clip,
        WebkitClipPath: clip,
        // Promote this container to its own compositing layer. WebKit then
        // renders the filtered child's feImage displacement filter (it stays
        // blank in the shared stage layer), exactly like the debug lens gets a
        // layer from its `position: fixed` parent. Promoting the static PARENT —
        // instead of `will-change: filter` on the filtered child — lets WebKit
        // cache the filter result and only re-run it when the source changes,
        // which is the difference between the debug lens's smooth perf and the
        // stutter `will-change: filter` caused. No-op on Chromium.
        transform: 'translateZ(0)',
        willChange: 'transform',
      }}
    >
      <OpenGlassFilter id={filterId} material={material} margin={MARGIN} />

      <div
        ref={filteredRef}
        style={{
          position: 'absolute',
          inset: 0,
          // Bound the filter's painted source so WebKit doesn't skip the filter
          // when the clone subtree overflows.
          overflow: 'hidden',
          filter: `url(#${filterId})`,
          WebkitFilter: `url(#${filterId})`,
        }}
      >
        <div
          ref={cloneWrapperRef}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            transformOrigin: '0 0',
            // Blur the source DOM here (world px, so it scales with zoom) rather
            // than via feGaussianBlur in the SVG filter — WebKit's blur shifts the
            // refracted backdrop, a CSS blur doesn't.
            filter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
            WebkitFilter: material.blur > 0 ? `blur(${material.blur}px)` : undefined,
          }}
        />
      </div>

      {/* Glass rim + glare (not filtered). */}
      <div
        style={{
          position: 'absolute',
          left: MARGIN,
          top: MARGIN,
          width: paneW,
          height: paneH,
          ...overlayStyle,
        }}
      />
    </div>
  )
}
