import { PAGE_BREAK_MARKER } from './markdown'

/** Inserts a page-break marker as its own paragraph right before the given source line. */
export function insertPageBreakBeforeLine(markdown: string, line: number): string {
  const lines = markdown.split('\n')
  const at = Math.max(0, Math.min(line, lines.length))
  lines.splice(at, 0, PAGE_BREAK_MARKER, '')
  return lines.join('\n')
}

/** Removes the page-break marker line (and one trailing blank line, if any) starting at `line`. */
export function removeMarkedLine(markdown: string, line: number): string {
  const lines = markdown.split('\n')
  if (line < 0 || line >= lines.length || lines[line].trim() !== PAGE_BREAK_MARKER) return markdown

  const removeCount = lines[line + 1]?.trim() === '' ? 2 : 1
  lines.splice(line, removeCount)
  return lines.join('\n')
}
