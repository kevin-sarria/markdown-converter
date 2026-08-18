import MarkdownIt from 'markdown-it'
import type { MarkdownIt as MarkdownItInstance } from 'markdown-it'

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
