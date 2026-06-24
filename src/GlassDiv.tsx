import { forwardRef, useEffect, useRef, type HTMLAttributes } from 'react'
import type { GlassMotionValue } from './motion'

export interface GlassDivProps extends HTMLAttributes<HTMLDivElement> {
  x?: GlassMotionValue
  y?: GlassMotionValue
  scaleX?: GlassMotionValue
  scaleY?: GlassMotionValue
}

/**
 * A transform-only `div`: composes translate/scale from motion values straight
 * onto `style.transform` without re-rendering, so a control can animate at
 * 60fps during a drag. Not required to use the glass — a building block for
 * interactive controls.
 */
export const GlassDiv = forwardRef<HTMLDivElement, GlassDivProps>(function GlassDiv(
  { x, y, scaleX, scaleY, style, children, ...rest },
  forwardedRef,
) {
  const nodeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = nodeRef.current
    if (!node) return
    const sources = [x, y, scaleX, scaleY].filter((v): v is GlassMotionValue => v != null)
    const compose = () => {
      // 2D translate only — a `translate3d`/`translateZ` here promotes the node
      // to its own GPU layer, which WebKit then refuses to rasterize into an SVG
      // filter's source graphic (so a refracted copy reads as empty). 2D
      // transforms stay in the painted source and are still cheap to animate.
      let transform = ''
      if (x || y) {
        transform = `translate(${x ? x.get() : 0}px, ${y ? y.get() : 0}px)`
      }
      if (scaleX || scaleY) {
        transform += `${transform ? ' ' : ''}scale(${scaleX ? scaleX.get() : 1}, ${scaleY ? scaleY.get() : 1})`
      }
      node.style.transform = transform
    }
    compose()
    const detaches = sources.map((v) => v.on('change', compose))
    return () => detaches.forEach((off) => off())
  }, [x, y, scaleX, scaleY])

  return (
    <div
      ref={(node) => {
        nodeRef.current = node
        if (typeof forwardedRef === 'function') forwardedRef(node)
        else if (forwardedRef) forwardedRef.current = node
      }}
      style={style}
      {...rest}
    >
      {children}
    </div>
  )
})
