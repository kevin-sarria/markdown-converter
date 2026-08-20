import {
  COL_CLASS,
  COL_WIDTH_ATTR,
  MIN_WIDTH_PERCENT,
  ROW_ALIGN_ATTR,
  ROW_ATTR,
  ROW_CLASS,
  buildRowHtml,
  normalizeWidths,
  widthsAfterAdd,
  widthsAfterRemove,
  type ColumnAlign,
} from './columns'

/**
 * Every edit the user can make to a columns row, as operations on the DOM.
 *
 * The preview is a contentEditable whose HTML is converted back to Markdown
 * after each change (useEditableMarkdown), so the DOM *is* the working state —
 * these functions mutate it and the caller then calls syncNow(). Nothing here
 * keeps a parallel copy in React state; there is only ever one truth.
 *
 * They live apart from the components because this is where content gets lost:
 * removing a column, unwrapping a row, dropping an image beside another. Kept
 * here, each one is a plain DOM-in/DOM-out function with a test.
 */

export function isColumnsRow(node: Element | null | undefined): node is HTMLElement {
  return Boolean(node && node.nodeType === 1 && node.hasAttribute(ROW_ATTR))
}

export function columnsOfRow(row: HTMLElement): HTMLElement[] {
  return Array.from(row.children).filter((c): c is HTMLElement => c.classList.contains(COL_CLASS))
}

export function readWidths(row: HTMLElement): number[] {
  return normalizeWidths(
    columnsOfRow(row).map((column) => {
      const raw = Number(column.getAttribute(COL_WIDTH_ATTR))
      return Number.isFinite(raw) && raw > 0 ? raw : null
    }),
  )
}

/** Writes widths onto the columns — the attribute is the source of truth, the flex style follows it. */
export function applyWidths(row: HTMLElement, widths: number[]): void {
  columnsOfRow(row).forEach((column, i) => {
    const width = widths[i] ?? MIN_WIDTH_PERCENT
    column.setAttribute(COL_WIDTH_ATTR, String(width))
    column.style.flex = `${width} 1 0%`
  })
}

export function addColumn(row: HTMLElement): void {
  insertColumnAt(row, columnsOfRow(row).length, '')
}

export function insertColumnAt(row: HTMLElement, index: number, html: string): void {
  const columns = columnsOfRow(row)
  const widths = widthsAfterAdd(readWidths(row))

  const column = document.createElement('div')
  column.className = COL_CLASS
  column.setAttribute('contenteditable', 'true')
  column.innerHTML = html

  const before = columns[index]
  if (before) row.insertBefore(column, before)
  else row.appendChild(column)

  // widthsAfterAdd appends the newcomer's share at the end; move it into place.
  const newcomer = widths.pop() as number
  widths.splice(Math.min(index, widths.length), 0, newcomer)
  applyWidths(row, widths)
}

/**
 * Removes a column, moving whatever was inside it into a neighbour first.
 *
 * Deleting the content along with the column is what a spreadsheet does, but
 * here the button sits one click away from a paragraph the user wrote, and the
 * edit lands in a document with no undo of its own. Keeping the text costs them
 * one delete; losing it costs them the paragraph.
 */
export function removeColumn(row: HTMLElement, index: number): void {
  const columns = columnsOfRow(row)
  const victim = columns[index]
  if (!victim || columns.length <= 1) return

  const neighbour = columns[index - 1] ?? columns[index + 1]
  while (victim.firstChild) neighbour.appendChild(victim.firstChild)
  victim.remove()

  applyWidths(row, widthsAfterRemove(readWidths(row), index))
}

export function equalizeWidths(row: HTMLElement): void {
  applyWidths(row, normalizeWidths(columnsOfRow(row).map(() => null)))
}

export function setRowAlign(row: HTMLElement, align: ColumnAlign): void {
  row.setAttribute(ROW_ALIGN_ATTR, align)
}

/** Dissolves the row, leaving its blocks stacked in the document in reading order. */
export function unwrapRow(row: HTMLElement): void {
  const parent = row.parentNode
  if (!parent) return

  for (const column of columnsOfRow(row)) {
    while (column.firstChild) parent.insertBefore(column.firstChild, row)
  }
  row.remove()
}

export function deleteRow(row: HTMLElement): void {
  row.remove()
}

/**
 * Replaces a block with a two-column row holding that block and some new
 * content — the drop half of dragging one image beside another.
 */
export function wrapSideBySide(target: HTMLElement, incomingHtml: string, side: 'left' | 'right'): HTMLElement {
  const parent = target.parentNode
  if (!parent) throw new Error('wrapSideBySide: the target block is not in the document')

  const holder = document.createElement('div')
  holder.innerHTML = buildRowHtml([{ widthPercent: 50 }, { widthPercent: 50 }])
  const row = holder.firstElementChild as HTMLElement
  const [first, second] = columnsOfRow(row)

  parent.insertBefore(row, target)
  const [forTarget, forIncoming] = side === 'left' ? [second, first] : [first, second]
  forTarget.appendChild(target)
  forIncoming.innerHTML = incomingHtml

  return row
}

export type DropSide = 'left' | 'right'

export interface SideDropTarget {
  img: HTMLImageElement
  side: DropSide
}

/**
 * The nearest block that owns `node` — the paragraph around an image rather
 * than the image itself. Stops at the editable region or at a column, since
 * those are containers, not blocks that can be moved into a row.
 */
export function blockOf(node: HTMLElement, root: HTMLElement): HTMLElement {
  let block = node
  while (
    block.parentElement &&
    block.parentElement !== root &&
    !block.parentElement.classList.contains(COL_CLASS)
  ) {
    block = block.parentElement
  }
  return block
}

/**
 * Puts `incomingHtml` beside an image the user dropped onto: as a new column if
 * that image already lives in a row, or by wrapping it into a fresh two-column
 * row if it doesn't. This is the whole "drag one image next to another" gesture,
 * minus the pointer maths.
 */
export function dropBeside(target: SideDropTarget, incomingHtml: string, root: HTMLElement): HTMLElement | null {
  const column = columnOf(target.img)
  const row = column && rowOf(column)

  if (row && column) {
    const index = columnsOfRow(row).indexOf(column)
    insertColumnAt(row, target.side === 'right' ? index + 1 : index, incomingHtml)
    return row
  }

  return wrapSideBySide(blockOf(target.img, root), incomingHtml, target.side)
}

/**
 * Takes an image out of the document after it has been dragged elsewhere, along
 * with the block that held it — but only if that block is now empty. A
 * paragraph that still has words in it is the user's text, not leftover
 * scaffolding.
 */
export function removeImageBlock(img: HTMLImageElement, root: HTMLElement): void {
  const block = blockOf(img, root)
  img.remove()

  const isEmpty = block !== img && block.children.length === 0 && (block.textContent ?? '').trim() === ''
  if (isEmpty) block.remove()
}

/** The row a node sits in, if any. */
export function rowOf(node: Node | null): HTMLElement | null {
  const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement
  return (element?.closest(`.${ROW_CLASS}`) as HTMLElement | null) ?? null
}

/** The column a node sits in, if any. */
export function columnOf(node: Node | null): HTMLElement | null {
  const element = node?.nodeType === 1 ? (node as Element) : node?.parentElement
  return (element?.closest(`.${COL_CLASS}`) as HTMLElement | null) ?? null
}
