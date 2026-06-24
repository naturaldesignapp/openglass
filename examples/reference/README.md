# Reference hosts (editor-coupled)

These two files are the **original editor implementations** that the `openglass`
package was extracted from. They are kept here as the canonical reference for how
to host the material in a real app.

> They are **not** part of any build and will **not** compile standalone — they
> import editor-only modules (`./store`, `./primitives`, `@naturaldesign/core`,
> `../editor/scene-graph`) and operate on the editor's live DOM (`.nd-stage`,
> `.nd-page-color-surface`, `data-shape-id`). Read them, don't run them.

| File | What it shows |
|------|---------------|
| `GlassLensDebug.tsx` | A draggable lens portaled to `document.body` that refracts a **live clone** of the canvas, plus the tuning panel. Clone sync via `MutationObserver`, `requestAnimationFrame` transform tracking, and the WebKit id-rotation / opacity-nudge tricks. |
| `CanvasNodeGlass.tsx` | A per-node glass "shader" rendered **inside** the stage so it inherits paint order. Prunes the glass node and everything painted on top of it from the clone, supports rect/ellipse/polygon clips, and promotes a compositing layer so WebKit renders the filter. |

For a **runnable, self-contained** version of the lens pattern (no editor, no live
DOM cloning — it refracts an aligned copy of a static backdrop), see
[`../demo/src/RefractingLens.tsx`](../demo/src/RefractingLens.tsx). That's the code that
powers the [live demo](https://openglass.vercel.app/).
