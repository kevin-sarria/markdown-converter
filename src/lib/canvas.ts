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

/** Where an item sits. Snapping and clamping only ever touch this part. */
export interface CanvasBox {
  /** Percent of the page, from its left edge. */
  x: number
  /** Percent of the page, from its top edge. */
  y: number
  /** Percent of the page width. */
  w: number
  /** Percent of the page height, or null to grow with the content. */
  h: number | null
}

export const CANVAS_ALIGNS = ['izquierda', 'centro', 'derecha'] as const
export type CanvasAlign = (typeof CANVAS_ALIGNS)[number]

export const CANVAS_FONTS = ['titulo', 'texto', 'mono'] as const
export type CanvasFont = (typeof CANVAS_FONTS)[number]

/** The smallest and largest type a page can usefully carry. */
export const MIN_SIZE_PT = 4
export const MAX_SIZE_PT = 200

/**
 * How a text box looks. It belongs to the box, not to the words inside it —
 * Markdown can say **bold** and *italic*, and those keep working inside an item,
 * but it has no way to express a colour or a point size. Rather than smuggling
 * raw HTML into the document to get them (and with it, a way for pasted
 * Markdown to inject anything), the box carries its own style and the Markdown
 * stays Markdown.
 *
 * Every field is nullable and null means "inherit the document", so an item that
 * was never styled adds no CSS at all and follows the theme like everything else.
 */
export interface CanvasItemStyle {
  sizePt: number | null
  /** A plain hex colour, or null. Nothing else is ever accepted — see readColor. */
  color: string | null
  align: CanvasAlign | null
  font: CanvasFont | null
}

export const NO_STYLE: CanvasItemStyle = { sizePt: null, color: null, align: null, font: null }

export interface CanvasItem extends CanvasBox {
  style: CanvasItemStyle
}

export interface CanvasItemContent extends CanvasBox {
  style?: CanvasItemStyle
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

  const rest = match[1].trim()
  const numbers = rest.match(/^(-?[\d.]+)\s*,\s*(-?[\d.]+)\s+([\d.]+)(?:\s*x\s*([\d.]+))?/)
  if (!numbers) return { x: 0, y: 0, w: 100, h: null, style: { ...NO_STYLE } }

  const [matched, x, y, w, h] = numbers
  return {
    x: Number(x),
    y: Number(y),
    w: Number(w),
    h: h === undefined ? null : Number(h),
    style: parseStyleProps(rest.slice(matched.length)),
  }
}

/** `size=26 color=#0b2a6b align=centro font=titulo`, in any order, all optional. */
function parseStyleProps(text: string): CanvasItemStyle {
  const props = new Map<string, string>()
  for (const [, key, value] of text.matchAll(/(\w+)=(\S+)/g)) props.set(key, value)

  return {
    sizePt: readSize(props.get('size')),
    color: readColor(props.get('color')),
    align: readOneOf(props.get('align'), CANVAS_ALIGNS),
    font: readOneOf(props.get('font'), CANVAS_FONTS),
  }
}

/**
 * Only a plain hex colour, ever.
 *
 * This value is written straight into the element's `style` attribute, so
 * anything else the browser would accept as CSS is a way into the page. The
 * strict pattern is the whole defence: what doesn't match is dropped, never
 * repaired.
 */
function readColor(value: string | undefined): string | null {
  if (!value) return null
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value) ? value : null
}

function readSize(value: string | undefined): number | null {
  if (value === undefined) return null
  const size = Number(value)
  if (!Number.isFinite(size) || size < MIN_SIZE_PT) return null
  return Math.min(MAX_SIZE_PT, Math.round(size * 10) / 10)
}

function readOneOf<T extends string>(value: string | undefined, allowed: readonly T[]): T | null {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : null
}

export function formatItemLine(item: CanvasBox & { style?: CanvasItemStyle }): string {
  const size = item.h === null ? num(item.w) : `${num(item.w)}x${num(item.h)}`
  const style = item.style ?? NO_STYLE

  const props = [
    style.sizePt === null ? null : `size=${num(style.sizePt)}`,
    style.color === null ? null : `color=${style.color}`,
    style.align === null ? null : `align=${style.align}`,
    style.font === null ? null : `font=${style.font}`,
  ].filter(Boolean)

  return [`${ITEM_PREFIX} ${num(item.x)},${num(item.y)} ${size}`, ...props].join(' ')
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
export function clampItem<T extends CanvasBox>(item: T): T {
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
 * The DOM shape of a canvas. The page is `contenteditable="false"` and so, by
 * inheritance, is every item on it.
 *
 * That is deliberate and it is the crux of this whole mode. An editable item
 * hands a drag to the browser's contentEditable machinery, which moves the node
 * to wherever it judges the caret to be — unpredictable, and occasionally
 * somewhere the content is lost. With items inert, a press-and-drag is ours to
 * interpret: it moves the box. Double-clicking an item is what turns its text
 * editing on, the same bargain PowerPoint makes (see useCanvasEditor.ts).
 */
export function buildCanvasHtml(items: CanvasItemContent[]): string {
  const boxes = items.map((item) => `${itemOpenTag(item)}${item.html ?? ''}</div>`).join('')
  return `${canvasOpenTag()}${boxes}</div>`
}

export function canvasOpenTag(): string {
  return `<div class="${CANVAS_CLASS}" ${CANVAS_ATTR} contenteditable="false">`
}

const CSS_ALIGN: Record<CanvasAlign, string> = {
  izquierda: 'left',
  centro: 'center',
  derecha: 'right',
}

const CSS_FONT: Record<CanvasFont, string> = {
  titulo: 'var(--p-font-heading)',
  texto: 'var(--p-font-body)',
  mono: 'var(--p-font-mono)',
}

export function itemOpenTag(raw: CanvasItemContent | CanvasItem): string {
  const item = clampItem(raw)
  const style = ('style' in raw ? raw.style : null) ?? NO_STYLE

  // Only what was actually set. An item that was never styled must add no CSS
  // at all, so it keeps following the document's theme like everything else.
  const css = [
    `left: ${num(item.x)}%`,
    `top: ${num(item.y)}%`,
    `width: ${num(item.w)}%`,
    item.h === null ? null : `height: ${num(item.h)}%`,
    style.sizePt === null ? null : `font-size: ${num(style.sizePt)}pt`,
    style.color === null ? null : `color: ${style.color}`,
    style.align === null ? null : `text-align: ${CSS_ALIGN[style.align]}`,
    style.font === null ? null : `font-family: ${CSS_FONT[style.font]}`,
  ]
    .filter(Boolean)
    .join('; ')

  const data = [
    `data-x="${num(item.x)}"`,
    `data-y="${num(item.y)}"`,
    `data-w="${num(item.w)}"`,
    item.h === null ? null : `data-h="${num(item.h)}"`,
    style.sizePt === null ? null : `data-size="${num(style.sizePt)}"`,
    style.color === null ? null : `data-color="${style.color}"`,
    style.align === null ? null : `data-align="${style.align}"`,
    style.font === null ? null : `data-font="${style.font}"`,
  ]
    .filter(Boolean)
    .join(' ')

  return `<div class="${ITEM_CLASS}" ${ITEM_ATTR} ${data} style="${css}">`
}

/** Reads an item's box back off the DOM, where dragging keeps it up to date. */
export function readItem(element: HTMLElement): CanvasItem {
  const read = (name: string) => {
    // `Number(null)` is 0, not NaN, so a missing attribute has to be caught
    // before the conversion — otherwise an item with no pinned height reads as
    // height zero, gets clamped up to the minimum, and every item in the
    // document quietly gains a fixed height nobody asked for.
    const raw = element.getAttribute(name)
    if (raw === null || raw.trim() === '') return null
    const value = Number(raw)
    return Number.isFinite(value) ? value : null
  }
  return clampItem({
    x: read('data-x') ?? 0,
    y: read('data-y') ?? 0,
    w: read('data-w') ?? 100,
    h: read('data-h'),
    style: {
      sizePt: readSize(element.getAttribute('data-size') ?? undefined),
      color: readColor(element.getAttribute('data-color') ?? undefined),
      align: readOneOf(element.getAttribute('data-align') ?? undefined, CANVAS_ALIGNS),
      font: readOneOf(element.getAttribute('data-font') ?? undefined, CANVAS_FONTS),
    },
  })
}

/** Applies a style to an item in the DOM, by rebuilding its tag's attributes. */
export function writeItemStyle(element: HTMLElement, style: CanvasItemStyle): void {
  const item = readItem(element)
  const holder = document.createElement('div')
  holder.innerHTML = `${itemOpenTag({ ...item, style })}</div>`
  const fresh = holder.firstElementChild as HTMLElement

  // Copy the computed attributes over rather than replacing the node: the node
  // is what the editor has selected and what holds the user's content.
  for (const name of ['data-size', 'data-color', 'data-align', 'data-font']) {
    const value = fresh.getAttribute(name)
    if (value === null) element.removeAttribute(name)
    else element.setAttribute(name, value)
  }
  element.setAttribute('style', fresh.getAttribute('style') ?? '')
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
