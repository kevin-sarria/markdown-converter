/**
 * A canvas page: a fixed-size page where every piece of content sits at a
 * position you chose, the way slides work — as opposed to the flowing text the
 * rest of this app produces.
 *
 *     ::: lienzo
 *     :: en 14,8 22
 *     ![Logo A](a.png)
 *     :: en 40,8 22
 *     ![Logo B](b.png)
 *     :: en 10,45 80
 *     **PROPUESTA DE INFRAESTRUCTURA**
 *     :::
 *
 * `:: en X,Y W` places an item's top-left corner at X,Y and makes it W wide;
 * `WxH` pins the height too, and without an H the item grows with its content.
 *
 * Everything is a **percentage of the page**, never millimetres or pixels. A
 * document whose page size or margins change later would otherwise scatter its
 * layout, and the preview is drawn at whatever scale fits the window — with
 * percentages, the same numbers describe the layout on screen, on A4, on
 * Letter, and in every exporter.
 *
 * Same family as the `::: columnas` syntax (columns.ts), on purpose: one set of
 * conventions to learn, one shape of parser and one shape of Turndown rule.
 */

export const CANVAS_NAME = 'lienzo'
export const ITEM_PREFIX = ':: en'

export const CANVAS_CLASS = 'md-canvas'
export const ITEM_CLASS = 'md-canvas-item'
export const CANVAS_ATTR = 'data-canvas'
export const ITEM_ATTR = 'data-canvas-item'

/** Small enough to be a logo, big enough to still be grabbable. */
export const MIN_ITEM_PERCENT = 2

export interface CanvasItem {
  /** Percent of the page, from its left edge. */
  x: number
  /** Percent of the page, from its top edge. */
  y: number
  /** Percent of the page width. */
  w: number
  /** Percent of the page height, or null to grow with the content. */
  h: number | null
}

export interface CanvasItemContent extends CanvasItem {
  /** Already-rendered inner HTML of the item. */
  html?: string
}

export function isCanvasOpen(line: string): boolean {
  return line.trim() === `::: ${CANVAS_NAME}`
}

/**
 * `:: en 14,8 22x30` → a box. A line that starts an item but has unreadable
 * numbers still counts as an item, filled in with a full-width default: the
 * alternative is discarding it, which takes the user's content with it.
 */
export function parseItemLine(line: string): CanvasItem | null {
  const match = line.trim().match(/^::\s+en\b(.*)$/)
  if (!match) return null

  const numbers = match[1]
    .trim()
    .match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)\s+([\d.]+)(?:\s*x\s*([\d.]+))?$/)
  if (!numbers) return { x: 0, y: 0, w: 100, h: null }

  const [, x, y, w, h] = numbers
  return { x: Number(x), y: Number(y), w: Number(w), h: h === undefined ? null : Number(h) }
}

export function formatItemLine(item: CanvasItem): string {
  const size = item.h === null ? num(item.w) : `${num(item.w)}x${num(item.h)}`
  return `${ITEM_PREFIX} ${num(item.x)},${num(item.y)} ${size}`
}

/**
 * One decimal is as fine as anyone can drag, and it keeps the floating-point
 * dust from a drag ("14.300000000000002") out of the document.
 */
function num(value: number): string {
  return String(Math.round(value * 10) / 10)
}

/**
 * Keeps a box on the page and big enough to grab. An item dragged past the edge
 * would be invisible and unreachable — there is no way to drag back something
 * you cannot see, and no undo here to rescue it.
 */
export function clampItem<T extends CanvasItem>(item: T): T {
  const w = clamp(item.w, MIN_ITEM_PERCENT, 100)
  const h = item.h === null ? null : clamp(item.h, MIN_ITEM_PERCENT, 100)
  return {
    ...item,
    w,
    h,
    x: clamp(item.x, 0, 100 - w),
    y: clamp(item.y, 0, 100 - (h ?? 0)),
  }
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

/**
 * The DOM shape of a canvas. The page itself is `contenteditable="false"` so
 * the caret can't wander into the gaps between items and start typing into the
 * page; each item is its own editable island, exactly like a columns row.
 */
export function buildCanvasHtml(items: CanvasItemContent[]): string {
  const boxes = items.map((item) => `${itemOpenTag(item)}${item.html ?? ''}</div>`).join('')
  return `${canvasOpenTag()}${boxes}</div>`
}

export function canvasOpenTag(): string {
  return `<div class="${CANVAS_CLASS}" ${CANVAS_ATTR} contenteditable="false">`
}

export function itemOpenTag(raw: CanvasItem): string {
  const item = clampItem(raw)
  const height = item.h === null ? '' : ` height: ${num(item.h)}%;`
  return (
    `<div class="${ITEM_CLASS}" ${ITEM_ATTR} ` +
    `data-x="${num(item.x)}" data-y="${num(item.y)}" data-w="${num(item.w)}"` +
    (item.h === null ? '' : ` data-h="${num(item.h)}"`) +
    ` style="left: ${num(item.x)}%; top: ${num(item.y)}%; width: ${num(item.w)}%;${height}" ` +
    `contenteditable="true">`
  )
}

/** Reads an item's box back off the DOM, where dragging keeps it up to date. */
export function readItem(element: HTMLElement): CanvasItem {
  const read = (name: string) => {
    const value = Number(element.getAttribute(name))
    return Number.isFinite(value) ? value : null
  }
  return clampItem({
    x: read('data-x') ?? 0,
    y: read('data-y') ?? 0,
    w: read('data-w') ?? 100,
    h: read('data-h'),
  })
}

/** Writes a box onto an item: the attributes are the truth, the style follows. */
export function writeItem(element: HTMLElement, raw: CanvasItem): CanvasItem {
  const item = clampItem(raw)
  element.setAttribute('data-x', num(item.x))
  element.setAttribute('data-y', num(item.y))
  element.setAttribute('data-w', num(item.w))
  element.style.left = `${num(item.x)}%`
  element.style.top = `${num(item.y)}%`
  element.style.width = `${num(item.w)}%`

  if (item.h === null) {
    element.removeAttribute('data-h')
    element.style.removeProperty('height')
  } else {
    element.setAttribute('data-h', num(item.h))
    element.style.height = `${num(item.h)}%`
  }
  return item
}
