import MarkdownIt from 'markdown-it'
import type { MarkdownIt as MarkdownItInstance, StateBlock } from 'markdown-it'

export const PAGE_BREAK_MARKER = '<!-- pagebreak -->'

export const md: MarkdownItInstance = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  breaks: false,
  highlight(str) {
    // Code blocks use a flat, theme-driven color (see .md-preview pre/code in preview.css)
    // instead of per-token syntax highlighting: canned highlight.js themes hardcode colors
    // that go unreadable against custom palettes, and html2canvas/docx export can't render
    // the same tokens anyway, so this keeps preview, PDF, HTML and Word output consistent.
    const escaped = md.utils.escapeHtml(str)
    return `<pre class="code-block"><code>${escaped}</code></pre>`
  },
})

// Open external links in a new tab in the live preview.
const defaultLinkOpen =
  md.renderer.rules.link_open ||
  function (tokens, idx, options, _env, self) {
    return self.renderToken(tokens, idx, options)
  }
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  const token = tokens[idx]
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return defaultLinkOpen(tokens, idx, options, env, self)
}

// Recognizes a `<!-- pagebreak -->` line as its own block, so it can force a real
// page break on export (see .page-break in preview.css) and be targeted by the
// click-to-remove affordance in PreviewPane.
md.block.ruler.before(
  'paragraph',
  'page_break',
  (state: StateBlock, startLine: number) => {
    const pos = state.bMarks[startLine] + state.tShift[startLine]
    const max = state.eMarks[startLine]
    if (state.src.slice(pos, max).trim() !== PAGE_BREAK_MARKER) return false

    state.line = startLine + 1
    const token = state.push('page_break', 'div', 0)
    token.map = [startLine, state.line]
    return true
  },
  { alt: ['paragraph', 'reference', 'blockquote', 'list'] },
)

md.renderer.rules.page_break = (tokens, idx) => {
  const line = tokens[idx].map?.[0] ?? 0
  return `<div class="page-break" data-page-break data-line="${line}"><span class="page-break-label">Salto de página</span></div>\n`
}

// Tags every top-level block with the source line it starts on, so the preview
// can map a click back to an exact line in the Markdown (see PreviewPane.tsx).
md.core.ruler.push('annotate_source_lines', (state) => {
  for (const token of state.tokens) {
    if (token.map && token.nesting >= 0) {
      token.attrSet('data-line', String(token.map[0]))
    }
  }
})

export function renderMarkdownToHtml(source: string): string {
  return md.render(source || '')
}

export const SAMPLE_MARKDOWN = `# Bienvenido a MD Studio

Escribe o pega tu **Markdown** a la izquierda y mira la vista previa a la derecha,
lista para exportar a *PDF*, *Word* o *HTML*.

## Características

- Cambia la **paleta de colores** y la **tipografía** en cualquier momento
- Exporta a \`PDF\`, \`DOCX\` y \`HTML\` totalmente en el navegador
- Nada se sube a ningún servidor — todo ocurre en tu equipo

### Ejemplo de código

\`\`\`js
function saludar(nombre) {
  return \`Hola, \${nombre}!\`
}
\`\`\`

> Este es un bloque de cita. Útil para resaltar ideas importantes.

| Formato | Soportado |
| --- | --- |
| PDF | ✅ |
| Word (.docx) | ✅ |
| HTML | ✅ |

1. Sube tu archivo \`.md\`
2. Ajusta el estilo
3. Exporta

[Más información](https://www.markdown.es/)
`
