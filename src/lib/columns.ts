/**
 * The single definition of what a "columns row" is, shared by everything that
 * touches one: the markdown-it rule that parses it (columnsPlugin.ts), the
 * Turndown rule that writes it back (htmlToMarkdown.ts), the editing UI
 * (useColumnsRow.ts, ColumnsButton.tsx) and the Word exporter (exportDocx.ts).
 *
 * Markdown has no layout syntax of its own, so a row is written as a container
 * block — the `:::` convention used by VitePress/Docusaurus and friends:
 *
 *     ::: columnas
 *     :: col 60
 *     ![Diagrama](img/diagrama.png)
 *     :: col 40
 *     ### Puntos clave
 *     :::
 *
 * The alternative would have been raw HTML `<div>`s, which renders in more
 * places but forces `html: true` on markdown-it — and with it, arbitrary HTML
 * injection from any pasted Markdown. Keeping the parser locked down is worth
 * more than GitHub rendering the columns.
 */

export const ROW_OPEN_PREFIX = ':::'
export const ROW_NAME = 'columnas'
export const ROW_CLOSE = ':::'
export const COL_PREFIX = ':: col'

/** Class names and data attributes of the rendered DOM, in one place. */
export const ROW_CLASS = 'md-cols'
export const COL_CLASS = 'md-col'
export const ROW_ATTR = 'data-cols'
export const COL_WIDTH_ATTR = 'data-w'
export const ROW_ALIGN_ATTR = 'data-align'

/** No column may be squeezed below this share of the row. */
export const MIN_WIDTH_PERCENT = 10

export const COLUMN_ALIGNS = ['arriba', 'centro', 'abajo'] as const
export type ColumnAlign = (typeof COLUMN_ALIGNS)[number]
export const DEFAULT_ALIGN: ColumnAlign = 'arriba'

export interface ColumnSpec {
  /** null means "share whatever the numbered columns left over". */
  widthPercent: number | null
  /** Already-rendered inner HTML of the column, when building DOM. */
  html?: string
}

/** `::: columnas centro` → `{ align: 'centro' }`; anything else → null. */
export function parseRowOpen(line: string): { align: ColumnAlign } | null {
  const match = line.trim().match(/^:::\s*(\S+)(?:\s+(\S+))?\s*$/)
  if (!match || match[1] !== ROW_NAME) return null
  const keyword = match[2] as ColumnAlign | undefined
  return { align: keyword && COLUMN_ALIGNS.includes(keyword) ? keyword : DEFAULT_ALIGN }
}

export function isRowClose(line: string): boolean {
  return line.trim() === ROW_CLOSE
}

/**
 * `:: col 60` → `{ widthPercent: 60 }`, `:: col` → `{ widthPercent: null }`.
 * A width that can't be read is treated as "no width" rather than as "not a
 * column": dropping the column entirely would silently swallow its content.
 */
export function parseColLine(line: string): { widthPercent: number | null } | null {
  const match = line.trim().match(/^::\s+col\b(.*)$/)
  if (!match) return null
  const rest = match[1].trim()
  const width = rest.match(/^(\d+)$/)
  return { widthPercent: width ? Number(width[1]) : null }
}

/**
 * Turns whatever widths a document happens to carry into whole percentages that
 * add up to exactly 100, with no column below MIN_WIDTH_PERCENT.
 *
 * Hand-written Markdown will have widths that don't add up, or none at all, and
 * dragging a divider can push a column toward zero. Rather than rejecting any
 * of that, every consumer normalizes on the way in, so the rendered row and the
 * exported document always agree on the arithmetic.
 */
export function normalizeWidths(widths: (number | null)[]): number[] {
  const count = widths.length
  if (count === 0) return []
  // More columns than the minimum share allows — the floor is unsatisfiable,
  // so equal shares is the only sane answer.
  if (count * MIN_WIDTH_PERCENT > 100) return roundToHundred(widths.map(() => 100 / count))

  const numbered = widths.filter((w): w is number => w !== null)
  const numberedTotal = numbered.reduce((sum, w) => sum + w, 0)
  const blanks = count - numbered.length
  const leftover = Math.max(0, 100 - numberedTotal)
  const perBlank = blanks > 0 ? Math.max(MIN_WIDTH_PERCENT, leftover / blanks) : 0

  const seeded = widths.map((w) => (w === null ? perBlank : Math.max(MIN_WIDTH_PERCENT, w)))
  return roundToHundred(scaleToHundred(seeded))
}

/**
 * Scales values to sum 100 while honouring the per-column floor. A plain
 * proportional scale can push a small column under the floor, so any column
 * that lands there is pinned at the floor and the rest are rescaled to fill
 * what remains — repeated until nothing else drops through.
 */
function scaleToHundred(values: number[]): number[] {
  const pinned = values.map(() => false)

  for (let pass = 0; pass <= values.length; pass++) {
    const pinnedCount = pinned.filter(Boolean).length
    const freeTarget = 100 - pinnedCount * MIN_WIDTH_PERCENT
    const freeCount = values.length - pinnedCount
    const freeTotal = values.reduce((sum, v, i) => (pinned[i] ? sum : sum + v), 0)

    const scaled = values.map((v, i) => {
      if (pinned[i]) return MIN_WIDTH_PERCENT
      return freeTotal > 0 ? (v * freeTarget) / freeTotal : freeTarget / freeCount
    })

    const dropped = scaled.findIndex((v, i) => !pinned[i] && v < MIN_WIDTH_PERCENT - 1e-9)
    if (dropped === -1) return scaled
    pinned[dropped] = true
  }

  return values.map(() => 100 / values.length)
}

/**
 * Rounds to whole percentages that still add up to exactly 100 (largest
 * remainder), so the rendered flex ratios and the Word cell widths never drift
 * a point apart from each other.
 */
function roundToHundred(values: number[]): number[] {
  const floors = values.map((v) => Math.floor(v))
  let deficit = 100 - floors.reduce((sum, v) => sum + v, 0)

  const byRemainder = values
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder)

  const out = [...floors]
  for (const { i } of byRemainder) {
    if (deficit <= 0) break
    out[i] += 1
    deficit--
  }
  return out
}

/**
 * Width arithmetic for the editing gestures. Kept here, pure and separate from
 * the DOM, because these are the calculations that go wrong quietly: a row that
 * adds up to 97 or 103 looks almost right on screen and only shows up as a
 * crooked column in the exported PDF.
 */

/** A new column takes an equal share; the existing ones shrink but keep their ratio. */
export function widthsAfterAdd(current: number[]): number[] {
  const share = 100 / (current.length + 1)
  const shrink = (100 - share) / 100
  return normalizeWidths([...current.map((w) => w * shrink), share])
}

/** The removed column's space goes back to the survivors, in proportion. */
export function widthsAfterRemove(current: number[], index: number): number[] {
  return normalizeWidths(current.filter((_, i) => i !== index))
}

/**
 * Dragging the divider between two neighbours moves width from one to the
 * other and touches nobody else, so the rest of the row stays put under the
 * user's hands. `delta` is in percentage points of the whole row.
 */
export function widthsAfterDrag(left: number, right: number, delta: number): [number, number] {
  const pair = left + right
  const newLeft = Math.round(Math.min(pair - MIN_WIDTH_PERCENT, Math.max(MIN_WIDTH_PERCENT, left + delta)))
  return [newLeft, pair - newLeft]
}

/**
 * The DOM shape of a row. Built here rather than in each caller so a row typed
 * as Markdown and a row inserted from the toolbar are byte-identical — the same
 * reason the page-break markup lives in one place.
 *
 * The wrapper is `contenteditable="false"` so the browser treats it as an
 * atomic node and the caret can't tear the row in half on backspace; each
 * column is its own editable island inside it.
 */
export function buildRowHtml(columns: ColumnSpec[], align: ColumnAlign = DEFAULT_ALIGN): string {
  const widths = normalizeWidths(columns.map((c) => c.widthPercent))
  const cells = columns
    .map((col, i) => `${colOpenTag(widths[i])}${col.html ?? ''}</div>`)
    .join('')

  return `${rowOpenTag(align)}${cells}</div>`
}

/**
 * The opening tags on their own, for the markdown-it renderer — which emits the
 * open tag, then the column's own rendered children, then the close tag, and so
 * can't use buildRowHtml. Sharing the tags keeps a row parsed from Markdown and
 * a row inserted from the toolbar identical, which is what lets the same
 * Turndown rule read either one back.
 */
export function rowOpenTag(align: ColumnAlign): string {
  return `<div class="${ROW_CLASS}" ${ROW_ATTR} ${ROW_ALIGN_ATTR}="${align}" contenteditable="false">`
}

export function colOpenTag(widthPercent: number): string {
  return (
    `<div class="${COL_CLASS}" ${COL_WIDTH_ATTR}="${widthPercent}" ` +
    `style="flex: ${widthPercent} 1 0%" contenteditable="true">`
  )
}
