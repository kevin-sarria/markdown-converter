/**
 * Resized images (see ImageResizeHandle.tsx) store their chosen width as a
 * `#w=NNN` fragment appended to the image's `src` — including on `data:` URIs,
 * where a fragment is harmless (browsers ignore it when decoding/loading the
 * image) but still round-trips through plain `![alt](src)` Markdown, since
 * Markdown has no attribute syntax of its own for image dimensions. This
 * keeps Markdown as the single source of truth without inventing a custom
 * Markdown extension or turning on raw HTML passthrough.
 */
const WIDTH_FRAGMENT = /#w=(\d+)$/

export function parseImageWidthFragment(src: string): { cleanSrc: string; widthPx: number | null } {
  const match = src.match(WIDTH_FRAGMENT)
  if (!match) return { cleanSrc: src, widthPx: null }
  return { cleanSrc: src.slice(0, match.index), widthPx: Number(match[1]) }
}

export function withImageWidthFragment(src: string, widthPx: number): string {
  const { cleanSrc } = parseImageWidthFragment(src)
  return `${cleanSrc}#w=${Math.round(widthPx)}`
}
