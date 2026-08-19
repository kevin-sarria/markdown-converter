import TurndownService from 'turndown'
import { PAGE_BREAK_MARKER } from './markdown'

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
turndownService.addRule('pageBreak', {
  filter: (node) => node.hasAttribute('data-page-break'),
  replacement: () => `\n\n${PAGE_BREAK_MARKER}\n\n`,
})

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
