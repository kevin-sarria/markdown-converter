import type { MarkdownIt as MarkdownItInstance, StateInline } from 'markdown-it'

/** Same hex discipline as canvas.ts's readColor — accept or drop, never repair. */
const COLOR_SUFFIX = /^\{color=(#(?:[0-9a-f]{3}|[0-9a-f]{6}))\}/i

/**
 * `[texto]{color=#hex}` — a per-word color override, for when a canvas box's
 * single `color=` isn't enough (see canvas.ts's CanvasItemStyle, which is
 * deliberately whole-box-only). Modeled on Pandoc's bracketed spans, and
 * distinguished from a real `[texto](url)` link by what follows the `]`.
 *
 * Registered globally (not scoped to `::: lienzo`) because scoping it would
 * cost real plumbing for no benefit — nothing stops colored text from being
 * useful in the flowing document too.
 */
export function colorSpanPlugin(md: MarkdownItInstance): void {
  md.inline.ruler.before('link', 'color_span', colorSpanRule)

  md.renderer.rules.color_open = (tokens, idx) => `<span style="color: ${tokens[idx].attrGet('color')}">`
  md.renderer.rules.color_close = () => '</span>'
}

function colorSpanRule(state: StateInline, silent: boolean): boolean {
  if (state.src.charCodeAt(state.pos) !== 0x5b /* [ */) return false

  const labelStart = state.pos + 1
  const labelEnd = state.md.helpers.parseLinkLabel(state, state.pos, false)
  if (labelEnd < 0) return false

  const match = COLOR_SUFFIX.exec(state.src.slice(labelEnd + 1))
  if (!match) return false

  if (silent) return true

  state.push('color_open', 'span', 1).attrSet('color', match[1])

  const savedPos = state.pos
  const savedPosMax = state.posMax
  state.pos = labelStart
  state.posMax = labelEnd
  state.md.inline.tokenize(state)
  state.pos = savedPos
  state.posMax = savedPosMax

  state.push('color_close', 'span', -1)

  state.pos = labelEnd + 1 + match[0].length
  return true
}
