import {
  buildCanvasHtml,
  CANVAS_ATTR,
  CANVAS_CLASS,
  ITEM_ATTR,
  ITEM_CLASS,
  itemOpenTag,
  readItem,
  type CanvasItem,
  type CanvasItemContent,
} from './canvas'

/**
 * DOM operations on a canvas page. Same contract as columnsDom: mutate the DOM,
 * then let the caller sync it back to Markdown. The DOM is the working draft;
 * Markdown stays the single source of truth.
 */

export function isCanvasPage(node: Element | null | undefined): node is HTMLElement {
  return Boolean(node && node.nodeType === 1 && node.hasAttribute(CANVAS_ATTR))
}

export function canvasOf(node: Node | null): HTMLElement | null {
  const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement
  return (element?.closest(`.${CANVAS_CLASS}`) as HTMLElement | null) ?? null
}

export function itemOf(node: Node | null): HTMLElement | null {
  const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement
  return (element?.closest(`.${ITEM_CLASS}`) as HTMLElement | null) ?? null
}

export function itemsOfCanvas(canvas: HTMLElement): HTMLElement[] {
  return Array.from(canvas.children).filter((c): c is HTMLElement => c.classList.contains(ITEM_CLASS))
}

/** Every item on the page except this one — what a drag snaps against. */
export function siblingBoxes(item: HTMLElement): CanvasItem[] {
  const canvas = canvasOf(item)
  if (!canvas) return []
  return itemsOfCanvas(canvas)
    .filter((other) => other !== item)
    .map(readItem)
}

export function addItem(canvas: HTMLElement, html: string, box: CanvasItem): HTMLElement {
  const holder = document.createElement('div')
  holder.innerHTML = `${itemOpenTag(box)}${html}</div>`
  const item = holder.firstElementChild as HTMLElement
  canvas.appendChild(item)
  return item
}

export function deleteItem(item: HTMLElement): void {
  item.remove()
}

/**
 * Z-order is document order — the last child paints on top — so bringing an
 * item forward is moving it in the DOM, and the Markdown records it by writing
 * the items out in that same order.
 */
export function bringToFront(item: HTMLElement): void {
  canvasOf(item)?.appendChild(item)
}

export function sendToBack(item: HTMLElement): void {
  const canvas = canvasOf(item)
  if (canvas) canvas.insertBefore(item, canvas.firstChild)
}

/** A fresh canvas page, with one item so it isn't a blank rectangle. */
export function buildStarterCanvas(): string {
  const items: CanvasItemContent[] = [
    { x: 10, y: 42, w: 80, h: null, html: '<h1>Título de la portada</h1>' },
  ]
  return buildCanvasHtml(items)
}

export const ITEM_SELECTOR = `[${ITEM_ATTR}]`
