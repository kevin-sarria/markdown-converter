import type { MarkdownIt as MarkdownItInstance, StateBlock } from 'markdown-it'
import {
  canvasOpenTag,
  isCanvasOpen,
  itemOpenTag,
  parseItemLine,
  type CanvasAlign,
  type CanvasFont,
  type CanvasItem,
} from './canvas'
import { isRowClose } from './columns'
import { fenceMarkerOf, findFenceAwareClose, type LineReader } from './containerScan'

/**
 * Parses `::: lienzo` pages (see canvas.ts) — a page whose content sits where
 * it was put, rather than flowing.
 *
 * Structurally the twin of columnsPlugin: find the closing fence, split the
 * body at each item marker, and hand every item's source back to
 * `md.block.parse` so any Markdown block can live inside one. The difference is
 * only what the marker carries — a box instead of a width.
 */
export function canvasPlugin(md: MarkdownItInstance): void {
  md.block.ruler.before('paragraph', 'canvas_page', canvasRule, {
    alt: ['paragraph', 'reference', 'blockquote', 'list'],
  })

  md.renderer.rules.canvas_open = () => canvasOpenTag()
  md.renderer.rules.canvas_close = () => '</div>\n'
  md.renderer.rules.canvas_item_open = (tokens, idx) => {
    const token = tokens[idx]
    const height = token.attrGet('h')
    const size = token.attrGet('size')

    return itemOpenTag({
      x: Number(token.attrGet('x')),
      y: Number(token.attrGet('y')),
      w: Number(token.attrGet('w')),
      h: height === null ? null : Number(height),
      style: {
        sizePt: size === null ? null : Number(size),
        color: asText(token.attrGet('color')),
        align: asText(token.attrGet('align')) as CanvasAlign | null,
        font: asText(token.attrGet('font')) as CanvasFont | null,
      },
    })
  }
  md.renderer.rules.canvas_item_close = () => '</div>'
}

/** markdown-it types an attribute as string | number; these were all set as strings. */
function asText(value: string | number | null): string | null {
  return value === null ? null : String(value)
}

function canvasRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const lineAt: LineReader = (n) => state.src.slice(state.bMarks[n] + state.tShift[n], state.eMarks[n])

  if (!isCanvasOpen(lineAt(startLine))) return false

  // Still being typed — leave it as paragraphs rather than swallowing the rest
  // of the document into a page that flickers into existence mid-keystroke.
  const closeLine = findFenceAwareClose(lineAt, startLine + 1, endLine, isRowClose)
  if (closeLine === -1) return false

  const items = collectItems(lineAt, startLine + 1, closeLine)
  if (items.length === 0) return false

  if (silent) return true

  const canvasToken = state.push('canvas_open', 'div', 1)
  canvasToken.map = [startLine, closeLine + 1]

  for (const { box, lines } of items) {
    const token = state.push('canvas_item_open', 'div', 1)
    token.attrSet('x', String(box.x))
    token.attrSet('y', String(box.y))
    token.attrSet('w', String(box.w))
    if (box.h !== null) token.attrSet('h', String(box.h))
    // The style was already read and validated by parseItemLine; carrying it on
    // the token is what gets it to the renderer, which rebuilds the same tag the
    // toolbar and the Turndown rule both work with.
    if (box.style.sizePt !== null) token.attrSet('size', String(box.style.sizePt))
    if (box.style.color !== null) token.attrSet('color', box.style.color)
    if (box.style.align !== null) token.attrSet('align', box.style.align)
    if (box.style.font !== null) token.attrSet('font', box.style.font)

    state.md.block.parse(`${lines.join('\n')}\n`, state.md, state.env, state.tokens)
    state.push('canvas_item_close', 'div', -1)
  }

  state.push('canvas_close', 'div', -1)
  state.line = closeLine + 1
  return true
}

/**
 * Splits the page body at each `:: en` marker, stepping over fenced code blocks
 * so a code sample containing these very markers can't cut the page short.
 * Anything above the first marker joins the first item instead of being
 * discarded.
 */
function collectItems(
  lineAt: LineReader,
  from: number,
  to: number,
): { box: CanvasItem; lines: string[] }[] {
  const items: { box: CanvasItem; lines: string[] }[] = []
  const orphaned: string[] = []
  let current: { box: CanvasItem; lines: string[] } | null = null
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

    const box = parseItemLine(line)
    if (box) {
      current = { box, lines: [] }
      items.push(current)
      continue
    }

    ;(current?.lines ?? orphaned).push(line)
  }

  if (items.length > 0 && orphaned.length > 0) items[0].lines.unshift(...orphaned)
  return items
}
