import TurndownService from 'turndown'
import {
  COL_CLASS,
  COL_PREFIX,
  COL_WIDTH_ATTR,
  DEFAULT_ALIGN,
  normalizeWidths,
  ROW_ALIGN_ATTR,
  ROW_ATTR,
  ROW_CLOSE,
  ROW_NAME,
  ROW_OPEN_PREFIX,
  type ColumnAlign,
} from './columns'
import { PAGE_BREAK_LABEL_CLASS, PAGE_BREAK_MARKER } from './markdown'

/**
 * Converts the HTML produced by editing the WYSIWYG preview (PreviewPane.tsx)
 * back into Markdown, so Markdown stays the single source of truth that every
 * exporter (PDF/DOCX/HTML) already reads — no exporter needs to know editing
 * ever happened in HTML.
 *
 * `turndown-plugin-gfm` (the usual companion package for tables/strikethrough)
 * hasn't been updated in years, so instead of adding that dependency the small
 * set of GFM rules this app actually needs are written by hand below.
 */
const turndownService = new TurndownService({
  headingStyle: 'atx',
  bulletListMarker: '-',
  codeBlockStyle: 'fenced',
  fence: '```',
  emDelimiter: '*',
  strongDelimiter: '**',
  linkStyle: 'inlined',
})

// Atomic page-break node (see the `page_break` renderer rule in markdown.ts and
// the "Insertar salto de página" button in EditorToolbar.tsx — both produce the
// same `[data-page-break]` shape, so this one rule round-trips either source).
//
// It used to emit just the marker and drop whatever was inside. Marking the
// node `contenteditable="false"` stops the caret getting in, but not a drag:
// dropping an image while moving it around the preview parks it inside the
// break, and the next sync deleted it without a trace. Anything that lands in
// here comes back out — everything except the break's own label, which is
// chrome this rule put there itself.
turndownService.addRule('pageBreak', {
  filter: (node) => node.nodeType === 1 && node.hasAttribute('data-page-break'),
  replacement: (_content, node) => {
    const stray = Array.from((node as HTMLElement).childNodes)
      .filter((n) => !(n.nodeType === 1 && (n as Element).classList.contains(PAGE_BREAK_LABEL_CLASS)))
      .map((n) => (n.nodeType === 1 ? (n as Element).outerHTML : (n.textContent ?? '')))
      .join('')

    const rescued = turndownService.turndown(stray).trim()
    return rescued ? `\n\n${PAGE_BREAK_MARKER}\n\n${rescued}\n\n` : `\n\n${PAGE_BREAK_MARKER}\n\n`
  },
})

/**
 * Columns rows (see columns.ts). Each column is converted on its own, with a
 * recursive turndown() call, which is what lets a column hold any block the
 * rest of these rules already understand — lists, quotes, code, tables.
 *
 * Every branch below exists because contentEditable will hand back shapes the
 * renderer never produced: a column the user emptied, a row they deleted every
 * column out of, text the browser stranded between columns. The rule for all of
 * them is the same — never drop content on the floor. Losing a paragraph
 * because a div ended up in an odd place is the one failure the user cannot
 * undo, since this output immediately replaces their document.
 */
turndownService.addRule('columnsRow', {
  filter: (node) => node.nodeType === 1 && node.hasAttribute(ROW_ATTR),
  replacement: (_content, node) => {
    const row = node as HTMLElement
    const columns = Array.from(row.children).filter((child) => child.classList.contains(COL_CLASS))
    const stranded = strandedMarkdown(row)

    // Nothing but the wrapper left — there is no content to preserve.
    if (columns.length === 0) return stranded ? `\n\n${stranded}\n\n` : ''

    // One column is not a layout. Unwrap it rather than writing a row that
    // renders as a single full-width block anyway.
    if (columns.length === 1) return `\n\n${joinBlocks(columnMarkdown(columns[0]), stranded)}\n\n`

    const widths = normalizeWidths(columns.map(readWidth))
    const body = columns
      .map((column, i) => `${COL_PREFIX} ${widths[i]}\n${columnMarkdown(column)}`)
      .join('\n')

    const align = (row.getAttribute(ROW_ALIGN_ATTR) ?? DEFAULT_ALIGN) as ColumnAlign
    const opener = align === DEFAULT_ALIGN ? `${ROW_OPEN_PREFIX} ${ROW_NAME}` : `${ROW_OPEN_PREFIX} ${ROW_NAME} ${align}`

    return `\n\n${joinBlocks(`${opener}\n${body}\n${ROW_CLOSE}`, stranded)}\n\n`
  },
})

function columnMarkdown(column: Element): string {
  return turndownService.turndown(column.innerHTML).trim()
}

function readWidth(column: Element): number | null {
  const raw = Number(column.getAttribute(COL_WIDTH_ATTR))
  return Number.isFinite(raw) && raw > 0 ? raw : null
}

/** Anything inside the row wrapper that is not a column, re-emitted after it. */
function strandedMarkdown(row: HTMLElement): string {
  const loose = Array.from(row.childNodes)
    .filter((n) => !(n.nodeType === 1 && (n as Element).classList.contains(COL_CLASS)))
    .map((n) => (n.nodeType === 1 ? (n as Element).outerHTML : (n.textContent ?? '')))
    .join('')

  return turndownService.turndown(loose).trim()
}

function joinBlocks(...blocks: string[]): string {
  return blocks.filter(Boolean).join('\n\n')
}

turndownService.addRule('strikethrough', {
  filter: ['s', 'del'],
  replacement: (content) => `~~${content}~~`,
})

turndownService.addRule('table', {
  filter: 'table',
  replacement: (_content, node) => {
    const rows = Array.from(node.querySelectorAll('tr'))
    if (rows.length === 0) return ''

    const cellsOf = (row: Element) => Array.from(row.querySelectorAll('th, td')).map((cell) => cellText(cell))
    const header = cellsOf(rows[0])
    const separator = header.map(() => '---')
    const body = rows.slice(1).map(cellsOf)

    const line = (cells: string[]) => `| ${cells.join(' | ')} |`
    return `\n\n${[line(header), line(separator), ...body.map(line)].join('\n')}\n\n`
  },
})

function cellText(cell: Element): string {
  return (cell.textContent ?? '').trim().replace(/\|/g, '\\|').replace(/\s+/g, ' ')
}

export function htmlToMarkdown(html: string): string {
  return turndownService.turndown(html)
}
