# Formato de texto y color en el lienzo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring negrita/cursiva/tachado/listas and a real color picker (colores del tema + paleta estándar + selector nativo) to the floating toolbar of a canvas ("lienzo") text box, synchronized with the same buttons on the main toolbar, plus per-word text color that survives Markdown round-trip and Word export.

**Architecture:** A new `useTextFormatState` hook reads the live selection's formatting straight from `document.queryCommandState`/`queryCommandValue`, so both toolbars (top bar and the canvas floating bar) derive the same truth independently — no shared store needed. A new Markdown inline syntax, `[texto]{color=#hex}` (Pandoc-style bracketed span), carries a per-word color through the existing markdown-it → HTML → Turndown → Markdown pipeline the same way `**bold**` already does. `runsFromInline` in `exportDocx.ts` gets a `color_open`/`color_close` case exactly like its existing `strong_open`/`em_open` cases.

**Tech Stack:** React + TypeScript, markdown-it (inline rule), Turndown, `docx` (Word export), `document.execCommand` (already the app's own pattern for all contentEditable formatting — see `EditorToolbar.tsx`).

## Global Constraints

- Follow the design in `docs/superpowers/specs/2026-08-26-formato-texto-lienzo-diseno.md`.
- No new dependencies. The native color picker is the browser's own `<input type="color">`.
- The box's own `color=` stays the default; a `[texto]{color=#hex}` span only overrides the words it wraps.
- `[texto]{color=#hex}` must never be confused with a real link `[texto](url)`.
- Every hex color is validated with `/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i` before it reaches a `style` attribute or a Word run — same discipline `canvas.ts`'s `readColor` already applies, for the same reason (nothing this strict ever needs "repairing," only accepting or dropping).
- Pure logic gets an automated test (`vitest`); new React components/hooks get manual verification in a real browser — this codebase has no component/hook testing setup, and the existing specs (`2026-08-20-plantillas-portada-diseno.md`) already follow this split.

---

### Task 1: `rgbToHex` — normalizing colors from the live DOM

**Files:**
- Create: `src/lib/color.ts`
- Test: `src/lib/color.test.ts`

**Interfaces:**
- Produces: `rgbToHex(value: string): string | null` — used by Task 3 (`htmlToMarkdown.ts`) and Task 5 (`useTextFormatState.ts`).

Both `document.execCommand('foreColor')` output and `document.queryCommandValue('foreColor')` hand back colors as `rgb(r, g, b)`, never `#hex` — this is what turns that into the hex this app stores everywhere else.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/color.test.ts
import { describe, expect, test } from 'vitest'
import { rgbToHex } from './color'

describe('rgbToHex', () => {
  test('converts an rgb() triplet to hex', () => {
    expect(rgbToHex('rgb(11, 42, 107)')).toBe('#0b2a6b')
  })

  test('passes an already-hex value through unchanged', () => {
    expect(rgbToHex('#0B2A6B')).toBe('#0B2A6B')
  })

  test('pads single-digit channels', () => {
    expect(rgbToHex('rgb(0, 5, 255)')).toBe('#0005ff')
  })

  test('returns null for anything else', () => {
    expect(rgbToHex('')).toBeNull()
    expect(rgbToHex('transparent')).toBeNull()
    expect(rgbToHex('rgba(0, 0, 0, 0.5)')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/color.test.ts`
Expected: FAIL — `color.ts` does not exist yet.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/color.ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/color.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/color.ts src/lib/color.test.ts
git commit -m "feat: agrega rgbToHex para normalizar colores que vienen del DOM"
```

---

### Task 2: `[texto]{color=#hex}` — the Markdown syntax

**Files:**
- Create: `src/lib/colorSpanPlugin.ts`
- Test: `src/lib/colorSpanPlugin.test.ts`
- Modify: `src/lib/markdown.ts`

**Interfaces:**
- Consumes: none new.
- Produces: `colorSpanPlugin(md: MarkdownItInstance): void` — registers the inline rule and its renderer. Also produces the token shape later tasks depend on: `color_open` (with a `color` attribute, a `#hex` string) and `color_close`, exactly parallel to markdown-it's built-in `strong_open`/`strong_close`. Task 4 (`exportDocx.ts`) switches on these token types.

A Pandoc-style bracketed span: `[texto]{color=#0b2a6b}`. Distinguished from a real link by what follows `]` — `(` is a link, `{` is a color span — using `state.md.helpers.parseLinkLabel`, the same helper markdown-it's own link/image rules use to find a matching `]` (handles nested brackets and escaping correctly, so this doesn't need to be reimplemented by hand).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/colorSpanPlugin.test.ts
import { describe, expect, test } from 'vitest'
import { htmlToMarkdown } from './htmlToMarkdown'
import { renderMarkdownToHtml } from './markdown'

const roundTrip = (markdown: string) => htmlToMarkdown(renderMarkdownToHtml(markdown))

describe('a color span', () => {
  test('renders as a span with that color', () => {
    const html = renderMarkdownToHtml('normal [texto en azul]{color=#0b2a6b} normal')
    expect(html).toContain('<span style="color: #0b2a6b">texto en azul</span>')
  })

  test('keeps parsing markdown inside the span', () => {
    const html = renderMarkdownToHtml('[**negrita en azul**]{color=#0b2a6b}')
    expect(html).toContain('<strong>negrita en azul</strong>')
    expect(html).toContain('color: #0b2a6b')
  })

  test('does not swallow a real link', () => {
    const html = renderMarkdownToHtml('[un enlace](https://example.com)')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).not.toContain('color:')
  })

  test('ignores an invalid color and leaves the brackets as text', () => {
    const html = renderMarkdownToHtml('[texto]{color=rojo}')
    expect(html).not.toContain('<span')
    expect(html).toContain('{color=rojo}')
  })

  test('survives the Markdown round trip', () => {
    const back = roundTrip('normal [texto en azul]{color=#0b2a6b} normal')
    expect(back).toContain('[texto en azul]{color=#0b2a6b}')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/colorSpanPlugin.test.ts`
Expected: FAIL — no span is rendered, because the plugin doesn't exist yet and `[texto]{color=#hex}` renders as plain text with literal brackets.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/colorSpanPlugin.ts
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
```

Wire it in next to `canvasPlugin`/`columnsPlugin`:

```ts
// src/lib/markdown.ts — add near the top with the other imports
import { colorSpanPlugin } from './colorSpanPlugin'
```

```ts
// src/lib/markdown.ts — add right after `md.use(canvasPlugin)`
// Per-word color override (`[texto]{color=#hex}`) — see colorSpanPlugin.ts.
md.use(colorSpanPlugin)
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/colorSpanPlugin.test.ts`
Expected: PASS (5 tests)

If `state.md.helpers.parseLinkLabel` isn't typed on `StateInline['md']` in this version of `@types/markdown-it`, cast narrowly at the call site (`(state.md as any).helpers.parseLinkLabel(...)`) rather than widening any other type — the helper exists at runtime in every markdown-it version this app could plausibly use, this is strictly a typing gap.

- [ ] **Step 5: Run the full suite to check nothing else broke**

Run: `npx vitest run`
Expected: PASS — in particular `canvasRoundTrip.test.ts` and `columnsRoundTrip.test.ts` (registering a new inline rule must not change how existing links or emphasis render).

- [ ] **Step 6: Commit**

```bash
git add src/lib/colorSpanPlugin.ts src/lib/colorSpanPlugin.test.ts src/lib/markdown.ts
git commit -m "feat: agrega la sintaxis [texto]{color=#hex} para color por palabra"
```

---

### Task 3: Saving a color span back to Markdown

**Files:**
- Modify: `src/lib/htmlToMarkdown.ts`
- Test: extend `src/lib/colorSpanPlugin.test.ts`

**Interfaces:**
- Consumes: `rgbToHex` (Task 1).
- Produces: nothing new consumed by later tasks — this closes the loop Task 2 opened (parse ⇄ serialize).

When `document.execCommand('foreColor', false, '#0b2a6b')` runs inside a canvas item, the browser wraps the selection in either `<span style="color: rgb(11, 42, 107)">` or `<font color="#0b2a6b">` depending on the engine — both need to become `[texto]{color=#hex}` when the edited DOM is turned back into Markdown.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/colorSpanPlugin.test.ts`:

```ts
import { htmlToMarkdown } from './htmlToMarkdown'

describe('saving a color span back to Markdown', () => {
  test('a span with an inline rgb() style', () => {
    const html = '<p>normal <span style="color: rgb(11, 42, 107)">azul</span> normal</p>'
    expect(htmlToMarkdown(html)).toContain('[azul]{color=#0b2a6b}')
  })

  test('a legacy <font color> tag', () => {
    const html = '<p>normal <font color="#0b2a6b">azul</font> normal</p>'
    expect(htmlToMarkdown(html)).toContain('[azul]{color=#0b2a6b}')
  })

  test('a plain span with no color is left alone', () => {
    const html = '<p><span>sin color</span></p>'
    expect(htmlToMarkdown(html)).toBe('sin color')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/colorSpanPlugin.test.ts`
Expected: FAIL — Turndown's default rule drops the `<span>`/`<font>` wrapper entirely today, so no `[…]{color=…}` appears.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/htmlToMarkdown.ts — add to the imports
import { rgbToHex } from './color'
```

```ts
// src/lib/htmlToMarkdown.ts — add near the other turndownService.addRule calls,
// after the `strikethrough` rule
/**
 * A per-word color override (see colorSpanPlugin.ts). execCommand('foreColor')
 * produces either a `<span style="color: rgb(...)">` or a legacy
 * `<font color="#hex">` depending on the browser engine — both round-trip to
 * the same `[texto]{color=#hex}`.
 */
turndownService.addRule('colorSpan', {
  filter: (node) => colorOf(node as HTMLElement) !== null,
  replacement: (content, node) => `[${content}]{color=${colorOf(node as HTMLElement)}}`,
})

function colorOf(node: Node): string | null {
  if (node.nodeType !== 1) return null
  const el = node as HTMLElement
  if (el.tagName === 'FONT') return rgbToHex(el.getAttribute('color') ?? '')
  if (el.tagName === 'SPAN') return rgbToHex(el.style.color)
  return null
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/colorSpanPlugin.test.ts`
Expected: PASS (8 tests total in the file)

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/htmlToMarkdown.ts src/lib/colorSpanPlugin.test.ts
git commit -m "feat: guarda un span de color como [texto]{color=#hex} en el Markdown"
```

---

### Task 4: Color spans in the Word export

**Files:**
- Modify: `src/lib/exportDocx.ts:439-530` (`runsFromInline`)
- Test: extend `src/lib/exportDocxCanvas.test.ts`

**Interfaces:**
- Consumes: `color_open`/`color_close` tokens (Task 2), `expandHex` (already in this file, `exportDocx.ts:679`).
- Produces: nothing new — this is the last stop for a color span.

`runsFromInline` already tracks `bold`/`italic`/`strike` as local variables that get set on `_open` and reset on `_close` (`exportDocx.ts:469-486`). `color` gets the identical treatment: it starts at `base.color` (the box's own default, or the document default) and only changes while inside a `color_open`/`color_close` pair.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/exportDocxCanvas.test.ts`, inside `describe('the style of a canvas box in Word')`:

```ts
test('a word wrapped in a color span overrides the box color just for that word', async () => {
  const xml = await documentXml(
    lines('::: lienzo', ':: en 15,48 70 color=#0b2a6b', 'normal [roja]{color=#ff0000} normal', ':::'),
  )

  expect(xml).toContain('w:val="0B2A6B"')
  expect(xml).toContain('w:val="FF0000"')
})

test('a color span inside bold text keeps both', async () => {
  const xml = await documentXml(
    lines('::: lienzo', ':: en 10,10 60', '**[roja]{color=#ff0000} y negrita**', ':::'),
  )

  expect(xml).toContain('<w:b/>')
  expect(xml).toContain('w:val="FF0000"')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/exportDocxCanvas.test.ts`
Expected: FAIL — `w:val="FF0000"` never appears; today every run in the box uses the single box color.

- [ ] **Step 3: Write the implementation**

```ts
// src/lib/exportDocx.ts — inside runsFromInline (around line 460), add:
let color = base.color
```

Add right after the `bold`/`italic`/`strike` declarations (`exportDocx.ts:441-443`).

Update the `text` case (`exportDocx.ts:463`) to use the local `color` instead of `base.color`:

```ts
case 'text':
  if (token.content) push(new TextRun({ text: token.content, font: base.font, size: base.size, color, bold, italics: italic, strike }))
  break
```

Add two new cases to the same `switch`, next to `s_open`/`s_close`:

```ts
case 'color_open':
  color = expandHex(String(token.attrGet('color') ?? base.color))
  break
case 'color_close':
  color = base.color
  break
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/exportDocxCanvas.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/exportDocx.ts src/lib/exportDocxCanvas.test.ts
git commit -m "feat: exporta a Word el color de un span de texto dentro de una caja"
```

---

### Task 5: `useTextFormatState` — the state that connects both toolbars, wired into the top bar

**Files:**
- Create: `src/hooks/useTextFormatState.ts`
- Modify: `src/components/EditorToolbar.tsx`

**Interfaces:**
- Consumes: `rgbToHex` (Task 1).
- Produces:
  ```ts
  export interface TextFormatState {
    bold: boolean
    italic: boolean
    strike: boolean
    list: 'bullet' | 'number' | null
    color: string | null
  }
  export function useTextFormatState(): { format: TextFormatState; refresh: () => void }
  ```
  Task 7 (`CanvasTextFormatBar.tsx`) also consumes this hook.

Today neither toolbar shows which formatting is active at the cursor — that absence, more than the missing buttons, is what makes the two bars feel like separate, disconnected systems. Both bars will call this same hook; each derives its state independently from `document.queryCommandState`/`queryCommandValue`, so they agree by construction, without a shared store.

No automated test for this file — it's a thin, side-effecting wrapper around `document.queryCommandState`, which jsdom does not implement meaningfully (see the Global Constraints note on manual verification). It's covered by Task 8's manual pass.

- [ ] **Step 1: Write the hook**

```ts
// src/hooks/useTextFormatState.ts
import { useCallback, useEffect, useState } from 'react'
import { rgbToHex } from '../lib/color'

export interface TextFormatState {
  bold: boolean
  italic: boolean
  strike: boolean
  list: 'bullet' | 'number' | null
  color: string | null
}

const EMPTY_STATE: TextFormatState = { bold: false, italic: false, strike: false, list: null, color: null }

/**
 * What formatting is active at the current selection, read straight from the
 * browser rather than tracked by hand — `document.queryCommandState` is the
 * same API `document.execCommand` already answers to (see EditorToolbar.tsx),
 * so this can never drift from what a command would actually do.
 *
 * The main toolbar and the canvas item's floating toolbar each call this
 * independently. That is what makes them "the same bar" without a shared
 * store: both ask the one source of truth the browser already keeps.
 *
 * `refresh` exists because not every execCommand reliably fires
 * `selectionchange` in every browser — callers call it themselves right after
 * their own `document.execCommand(...)`, in addition to the automatic
 * listener below.
 */
export function useTextFormatState(): { format: TextFormatState; refresh: () => void } {
  const [format, setFormat] = useState<TextFormatState>(EMPTY_STATE)

  const refresh = useCallback(() => {
    try {
      setFormat({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        strike: document.queryCommandState('strikeThrough'),
        list: document.queryCommandState('insertUnorderedList')
          ? 'bullet'
          : document.queryCommandState('insertOrderedList')
            ? 'number'
            : null,
        color: rgbToHex(document.queryCommandValue('foreColor')),
      })
    } catch {
      setFormat(EMPTY_STATE)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', refresh)
    return () => document.removeEventListener('selectionchange', refresh)
  }, [refresh])

  return { format, refresh }
}
```

- [ ] **Step 2: Wire it into `EditorToolbar.tsx`**

```ts
// src/components/EditorToolbar.tsx — add to the imports
import { useTextFormatState } from '../hooks/useTextFormatState'
```

```ts
// src/components/EditorToolbar.tsx — inside the component, near the top
const { format, refresh } = useTextFormatState()
```

Update `exec` to refresh after every command:

```ts
const exec = (command: string, value?: string) => {
  focusEditable()
  document.execCommand(command, false, value)
  onEdited()
  refresh()
}
```

Give `ToolbarButton` a pressed look:

```ts
function ToolbarButton({
  onClick,
  title,
  pressed,
  children,
}: {
  onClick: () => void
  title: string
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-medium ${
        pressed ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
```

Pass `pressed` on the three buttons that have a matching command:

```tsx
<ToolbarButton title="Negrita" pressed={format.bold} onClick={() => exec('bold')}>
  <b>N</b>
</ToolbarButton>
<ToolbarButton title="Cursiva" pressed={format.italic} onClick={() => exec('italic')}>
  <i>K</i>
</ToolbarButton>
<ToolbarButton title="Tachado" pressed={format.strike} onClick={() => exec('strikeThrough')}>
  <s>S</s>
</ToolbarButton>
```

```tsx
<ToolbarButton title="Lista con viñetas" pressed={format.list === 'bullet'} onClick={() => exec('insertUnorderedList')}>
  •—
</ToolbarButton>
<ToolbarButton title="Lista numerada" pressed={format.list === 'number'} onClick={() => exec('insertOrderedList')}>
  1.—
</ToolbarButton>
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/hooks/useTextFormatState.ts src/components/EditorToolbar.tsx
git commit -m "feat: la barra de arriba muestra el formato activo en la selección"
```

---

### Task 6: `ColorPicker` — theme + standard palette + native "more colors", wired into the box color

**Files:**
- Create: `src/components/ColorPicker.tsx`
- Modify: `src/components/CanvasStyleBar.tsx`

**Interfaces:**
- Consumes: `ColorTheme` (`src/lib/themes.ts`, already used by `CanvasStyleBar.tsx` via `getTheme`).
- Produces:
  ```ts
  export default function ColorPicker(props: {
    value: string | null
    onChange: (hex: string) => void
    onClear?: () => void
    theme: ColorTheme
    onBeforeMoreColors?: () => void
  }): JSX.Element
  ```
  Task 7 (`CanvasTextFormatBar.tsx`) also consumes this component, passing `onBeforeMoreColors` to save the text selection before the native dialog steals focus.

No automated test — a visual, DOM-event-driven component (see Global Constraints). Covered by Task 8's manual pass.

- [ ] **Step 1: Write the component**

```tsx
// src/components/ColorPicker.tsx
import { useRef } from 'react'
import type { ColorTheme } from '../lib/themes'

/** Office's own "Standard Colors" row — a known, already-tested palette, and
 * the same one the user asked to be able to reach. */
const STANDARD_COLORS = [
  '#C00000',
  '#FF0000',
  '#FFC000',
  '#FFFF00',
  '#92D050',
  '#00B050',
  '#00B0F0',
  '#0070C0',
  '#002060',
  '#7030A0',
]

/**
 * Office-style color picker: theme colors, a standard palette, and "Más
 * colores…" for anything else — which just opens the operating system's own
 * color dialog via a hidden `<input type="color">`, rather than a picker
 * built from scratch here (see the design doc's decision on this).
 *
 * Used both for a canvas box's whole-box color (CanvasStyleBar.tsx) and for a
 * per-word text color (CanvasTextFormatBar.tsx) — the two differ only in
 * what `onChange` does with the hex it's handed.
 */
export default function ColorPicker({
  value,
  onChange,
  onClear,
  theme,
  onBeforeMoreColors,
}: {
  value: string | null
  onChange: (hex: string) => void
  onClear?: () => void
  theme: ColorTheme
  onBeforeMoreColors?: () => void
}) {
  const nativeInputRef = useRef<HTMLInputElement>(null)

  const themeSwatches = [
    { color: theme.heading, title: 'Color de títulos del tema' },
    { color: theme.text, title: 'Color de texto del tema' },
    { color: theme.muted, title: 'Color atenuado del tema' },
    { color: theme.accent, title: 'Color de acento del tema' },
  ]

  const swatch = (color: string, title: string) => (
    <button
      key={color}
      type="button"
      title={title}
      onClick={() => onChange(color)}
      className={`h-4 w-4 rounded-sm border ${
        value?.toLowerCase() === color.toLowerCase() ? 'border-white' : 'border-white/25'
      }`}
      style={{ background: color }}
    />
  )

  return (
    <div className="flex items-center gap-0.5">
      {themeSwatches.map(({ color, title }) => swatch(color, title))}
      <div className="mx-0.5 h-4 w-px bg-white/10" />
      {STANDARD_COLORS.map((color) => swatch(color, color))}
      <div className="mx-0.5 h-4 w-px bg-white/10" />
      <button
        type="button"
        title="Más colores…"
        onClick={() => {
          onBeforeMoreColors?.()
          nativeInputRef.current?.click()
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        ⋯
      </button>
      <input
        ref={nativeInputRef}
        type="color"
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      {onClear && (
        <button
          type="button"
          title="Volver al color del documento"
          onClick={onClear}
          className="flex h-6 w-6 items-center justify-center rounded text-xs text-white/50 hover:bg-white/10 hover:text-white"
        >
          ⌫
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `CanvasStyleBar.tsx`**

Replace the color block (`CanvasStyleBar.tsx:91-119` — the theme swatches, the native input, and the `⌫` button) with:

```tsx
<div className="mx-0.5 h-4 w-px bg-white/10" />

<ColorPicker value={style.color} onChange={(color) => setStyle({ color })} onClear={() => setStyle({ color: null })} theme={theme} />

<div className="mx-0.5 h-4 w-px bg-white/10" />
```

Add the import:

```ts
import ColorPicker from './ColorPicker'
```

The `swatches` constant (`CanvasStyleBar.tsx:43-48`) is now unused — remove it, since its four entries moved into `ColorPicker`.

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors — in particular, no unused-variable error for the old `swatches` array (confirm it was fully removed, not just its usage).

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS (no existing test touches `CanvasStyleBar.tsx`'s rendering directly, so this is a regression check on everything else).

- [ ] **Step 5: Commit**

```bash
git add src/components/ColorPicker.tsx src/components/CanvasStyleBar.tsx
git commit -m "feat: el color de una caja del lienzo usa un selector al estilo Office"
```

---

### Task 7: `CanvasTextFormatBar` — negrita, cursiva, tachado, listas y color de texto en el lienzo

**Files:**
- Create: `src/components/CanvasTextFormatBar.tsx`
- Modify: `src/components/CanvasItemMenu.tsx`

**Interfaces:**
- Consumes: `useTextFormatState` (Task 5), `ColorPicker` (Task 6), `CanvasEditor['selection']` (`useCanvasEditor.ts`, already existing — specifically `selection.syncNow()`), `ColorTheme`.
- Produces: nothing further consumed elsewhere — this is the top of the UI stack for this feature.

Mirrors `EditorToolbar.tsx`'s `exec` pattern exactly (`document.execCommand` + refresh), because a canvas item in text-edit mode is a `contenteditable="true"` island exactly like the region `EditorToolbar` already targets — no new selection-handling code is needed, only the same pattern applied a second time. Shown in place of the "✎ Texto" button while `editingText` is true, the same conditional shape `CanvasItemMenu.tsx:72` already uses.

- [ ] **Step 1: Write the component**

```tsx
// src/components/CanvasTextFormatBar.tsx
import { useRef } from 'react'
import ColorPicker from './ColorPicker'
import { useTextFormatState } from '../hooks/useTextFormatState'
import type { CanvasEditor } from '../hooks/useCanvasEditor'
import type { ColorTheme } from '../lib/themes'

function FormatButton({
  onClick,
  title,
  pressed,
  children,
}: {
  onClick: () => void
  title: string
  pressed?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-medium ${
        pressed ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Character-level formatting for the selected canvas item's text, while it is
 * in edit mode — negrita/cursiva/tachado/listas plus a per-word color. Lives
 * next to (not instead of) CanvasStyleBar: that bar is whole-box style
 * (size/color/align/font, see canvas.ts), this one is the words themselves,
 * the same split Markdown itself makes between a box's attributes and
 * **bold**/*italic* text.
 *
 * Uses `document.execCommand` exactly like EditorToolbar.tsx — a canvas item
 * in text-edit mode is the same kind of contenteditable island that toolbar
 * already knows how to act on.
 */
export default function CanvasTextFormatBar({ editor, theme }: { editor: CanvasEditor; theme: ColorTheme }) {
  const { format, refresh } = useTextFormatState()
  const savedRangeRef = useRef<Range | null>(null)

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editor.selection?.syncNow()
    refresh()
  }

  const restoreSelection = () => {
    const selection = window.getSelection()
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges()
      selection.addRange(savedRangeRef.current)
    }
  }

  return (
    <div className="flex items-center gap-0.5" onMouseDown={(e) => e.preventDefault()}>
      <FormatButton title="Negrita" pressed={format.bold} onClick={() => exec('bold')}>
        <b>N</b>
      </FormatButton>
      <FormatButton title="Cursiva" pressed={format.italic} onClick={() => exec('italic')}>
        <i>K</i>
      </FormatButton>
      <FormatButton title="Tachado" pressed={format.strike} onClick={() => exec('strikeThrough')}>
        <s>S</s>
      </FormatButton>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <FormatButton title="Lista con viñetas" pressed={format.list === 'bullet'} onClick={() => exec('insertUnorderedList')}>
        •—
      </FormatButton>
      <FormatButton title="Lista numerada" pressed={format.list === 'number'} onClick={() => exec('insertOrderedList')}>
        1.—
      </FormatButton>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <ColorPicker
        value={format.color}
        onChange={(hex) => {
          restoreSelection()
          exec('foreColor', hex)
        }}
        theme={theme}
        onBeforeMoreColors={() => {
          const selection = window.getSelection()
          savedRangeRef.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `CanvasItemMenu.tsx`**

Replace the "✎ Texto" conditional block (`CanvasItemMenu.tsx:72-76`) so it shows the new bar instead while editing:

```tsx
{editingText ? (
  <CanvasTextFormatBar editor={editor} theme={getTheme(settings.themeId)} />
) : (
  <MenuButton title="Editar el texto (o doble clic)" onClick={editor.beginTextEditing}>
    ✎ Texto
  </MenuButton>
)}
```

Add the imports:

```ts
import CanvasTextFormatBar from './CanvasTextFormatBar'
import { getTheme } from '../lib/settings'
```

- [ ] **Step 3: Type-check**

Run: `npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Run the full suite**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/CanvasTextFormatBar.tsx src/components/CanvasItemMenu.tsx
git commit -m "feat: negrita, cursiva, tachado, listas y color de texto en el lienzo"
```

---

### Task 8: Manual verification

No code changes. This is the check the automated suite structurally cannot do (jsdom doesn't implement `execCommand`/`queryCommandState`), using the Chrome DevTools/Playwright browser tools already available in this session instead of asking the user to do it by hand.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev` (background)

- [ ] **Step 2: Open the app, load a document with a `::: lienzo` cover, and select a text box**

Confirm the floating toolbar shows: negrita/cursiva/tachado, listas, and the new `ColorPicker` (theme row, standard row, "Más colores…") — replacing the old four fixed swatches.

- [ ] **Step 3: Bold sync between both bars**

Double-click the box to edit its text, select a word, click **N** on the *floating* bar. Confirm the word turns bold, and that moving the cursor into/out of that word toggles the **N** button's pressed state on the *top* bar too, without touching it.

- [ ] **Step 4: Text color**

Select a different word, pick a standard-palette color. Confirm only that word changes color, the rest of the box keeps the box's own color. Click "Más colores…", pick a custom color from the OS dialog on a third word, confirm it applies to the right word (this is the step that specifically checks the selection survives the native dialog).

- [ ] **Step 5: Lists**

With the cursor in the box, click "Lista con viñetas". Confirm it produces a bullet list visually indistinguishable from one made via the top bar.

- [ ] **Step 6: Round trip through Markdown**

Open the app's Markdown source view (or export to `.md` if that's the only way to inspect it) and confirm the colored word appears as `[palabra]{color=#hex}`. Reload the page with that content and confirm the color survives.

- [ ] **Step 7: Word export**

Export the document to `.docx`. Using the same LibreOffice headless verification approach as the previous canvas-positioning fix (`soffice.exe --headless --convert-to pdf`), confirm the colored word renders in its own color in the PDF, distinct from the rest of the box.

- [ ] **Step 8: Report back**

No commit for this task. Summarize what was checked and any issue found — if something's off, fix it and re-run the affected task's tests before moving on.
