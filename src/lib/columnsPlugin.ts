import type { MarkdownIt as MarkdownItInstance, StateBlock } from 'markdown-it'
import {
  colOpenTag,
  isRowClose,
  normalizeWidths,
  parseColLine,
  parseRowOpen,
  rowOpenTag,
  type ColumnAlign,
} from './columns'

/**
 * Parses `::: columnas` rows (see columns.ts for the format) into a nested
 * structure markdown-it can render.
 *
 * The one thing worth understanding here: the body of each column is handed
 * straight back to `md.block.parse`, the full block parser. That single line is
 * why a column can hold a heading, a list, a table, a code block — anything
 * Markdown can express — without this rule knowing what any of those are.
 *
 * Written by hand rather than pulling in markdown-it-container, because the
 * `:: col` splitting inside the container is the actual work here and that
 * plugin doesn't do it. Same reasoning as the hand-written page-break rule and
 * GFM Turndown rules elsewhere in this codebase.
 */
export function columnsPlugin(md: MarkdownItInstance): void {
  md.block.ruler.before('paragraph', 'columns_row', columnsRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })

  md.renderer.rules.columns_open = (tokens, idx) =>
    rowOpenTag((tokens[idx].attrGet('align') ?? 'arriba') as ColumnAlign)
  md.renderer.rules.columns_close = () => '</div>\n'
  md.renderer.rules.columns_col_open = (tokens, idx) => colOpenTag(Number(tokens[idx].attrGet('width') ?? 0))
  md.renderer.rules.columns_col_close = () => '</div>'
}

function columnsRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const lineAt = (n: number) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n])

  const open = parseRowOpen(lineAt(startLine))
  if (!open) return false

  // No closing fence means the user is still typing it. Bailing out leaves the
  // half-written row as ordinary paragraphs instead of swallowing the rest of
  // the document into a row that flickers into existence mid-keystroke.
  const closeLine = findCloseLine(lineAt, startLine + 1, endLine)
  if (closeLine === -1) return false

  const columns = collectColumns(lineAt, startLine + 1, closeLine)
  if (columns.length === 0) return false

  if (silent) return true

  const widths = normalizeWidths(columns.map((c) => c.widthPercent))

  const rowToken = state.push('columns_open', 'div', 1)
  rowToken.map = [startLine, closeLine + 1]
  rowToken.attrSet('align', open.align)

  columns.forEach((column, i) => {
    state.push('columns_col_open', 'div', 1).attrSet('width', String(widths[i]))
    // The full block parser, on the column's own source. Tokens land in the
    // same array the core chain is about to run its inline pass over, so
    // emphasis, links and images inside a column are handled for free.
    state.md.block.parse(`${column.lines.join('\n')}\n`, state.md, state.env, state.tokens)
    state.push('columns_col_close', 'div', -1)
  })

  state.push('columns_close', 'div', -1)
  state.line = closeLine + 1
  return true
}

type LineReader = (n: number) => string

/** Opening/closing fence of a code block, so scanning can step over its contents. */
function fenceMarkerOf(line: string): string | null {
  const match = line.trim().match(/^(`{3,}|~{3,})/)
  return match ? match[1] : null
}

/**
 * Finds the row's closing `:::`, ignoring anything inside a fenced code block.
 * Without that exception, documenting this very syntax inside a column — a code
 * block containing a `:::` line — would truncate the row and drop everything
 * after it.
 */
function findCloseLine(lineAt: LineReader, from: number, endLine: number): number {
  let fence: string | null = null

  for (let n = from; n < endLine; n++) {
    const line = lineAt(n)
    const marker = fenceMarkerOf(line)

    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      continue
    }
    if (marker) {
      fence = marker
      continue
    }
    if (isRowClose(line)) return n
  }

  return -1
}

/**
 * Splits the row body into columns at each `:: col` line, stepping over fenced
 * code blocks for the same reason findCloseLine does.
 *
 * Anything written above the first `:: col` joins the first column rather than
 * being discarded — a row is something the user is editing, and silently
 * deleting text they typed in the wrong spot is worse than putting it somewhere
 * slightly unexpected.
 */
function collectColumns(
  lineAt: LineReader,
  from: number,
  to: number,
): { widthPercent: number | null; lines: string[] }[] {
  const columns: { widthPercent: number | null; lines: string[] }[] = []
  const orphaned: string[] = []
  let current: { widthPercent: number | null; lines: string[] } | null = null
  let fence: string | null = null

  for (let n = from; n < to; n++) {
    const line = lineAt(n)
    const marker = fenceMarkerOf(line)

    if (fence) {
      if (marker && marker[0] === fence[0] && marker.length >= fence.length) fence = null
      ;(current?.lines ?? orphaned).push(line)
      continue
    }
    if (marker) {
      fence = marker
      ;(current?.lines ?? orphaned).push(line)
      continue
    }

    const column = parseColLine(line)
    if (column) {
      current = { widthPercent: column.widthPercent, lines: [] }
      columns.push(current)
      continue
    }

    ;(current?.lines ?? orphaned).push(line)
  }

  if (columns.length > 0 && orphaned.length > 0) columns[0].lines.unshift(...orphaned)
  return columns
}
