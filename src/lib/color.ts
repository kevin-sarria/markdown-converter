/**
 * Normalizes a CSS color to `#hex`, the only shape this app ever stores or
 * writes into a style attribute (see canvas.ts's readColor). The DOM only ever
 * hands back `rgb(r, g, b)` from execCommand('foreColor') and
 * queryCommandValue('foreColor') — never hex — so anything reading a live
 * selection's color needs this before the value can round-trip through
 * Markdown or reach a Word run.
 */
export function rgbToHex(value: string): string | null {
  const trimmed = value.trim()

  const rgb = trimmed.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i)
  if (rgb) {
    const [, r, g, b] = rgb
    return `#${[r, g, b].map((n) => Number(n).toString(16).padStart(2, '0')).join('')}`
  }

  if (/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(trimmed)) return trimmed

  return null
}
