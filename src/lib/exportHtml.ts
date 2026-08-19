import { saveAs } from 'file-saver'
import previewCss from '../styles/preview.css?raw'
import { renderCoverPageHtml, renderFooterBandHtml, renderHeaderBandHtml, renderWatermarkHtml } from './headerFooterMarkup'
import { renderMarkdownToHtml } from './markdown'
import { buildPreviewVarsCss } from './previewStyle'
import type { DocSettings } from './settings'

const GOOGLE_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Lora:wght@400;500;600;700&family=Merriweather:wght@400;700;900&family=Playfair+Display:wght@500;600;700;800&family=Roboto+Slab:wght@400;500;700&family=Source+Sans+3:wght@400;600;700&family=JetBrains+Mono:wght@400;500;700&family=Fira+Code:wght@400;500&family=IBM+Plex+Mono:wght@400;500&display=swap'

export function buildStandaloneHtml(markdown: string, settings: DocSettings, title: string): string {
  const body = renderMarkdownToHtml(markdown)
  const vars = buildPreviewVarsCss(settings)
  const coverHtml = renderCoverPageHtml(settings.coverPage)
  const headerHtml = renderHeaderBandHtml(settings.headerFooter)
  const footerHtml = renderFooterBandHtml(settings.headerFooter)
  const watermarkHtml = renderWatermarkHtml(settings.watermark)

  // The header/footer here render once, at the top/bottom of the document —
  // a plain HTML file isn't paginated the way the PDF export is, so there's no
  // reliable way to repeat them per printed page from pure HTML/CSS.
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="${GOOGLE_FONTS_HREF}" />
<style>
  body { margin: 0; background: #f2f2f5; display: flex; justify-content: center; padding: 32px 12px; }
  ${previewCss}
</style>
</head>
<body>
<div class="md-page-wrap" style="${vars} box-shadow: 0 1px 3px rgba(0,0,0,.12), 0 12px 28px -8px rgba(0,0,0,.25);">
${coverHtml}
${headerHtml}
<div class="md-preview" style="${vars}">
${body}
</div>
${footerHtml}
${watermarkHtml}
</div>
</body>
</html>
`
}

export function buildHtmlBlob(markdown: string, settings: DocSettings, title: string): Blob {
  const html = buildStandaloneHtml(markdown, settings, title)
  return new Blob([html], { type: 'text/html;charset=utf-8' })
}

export function exportToHtml(markdown: string, settings: DocSettings, fileName: string): void {
  const blob = buildHtmlBlob(markdown, settings, fileName)
  saveAs(blob, `${fileName}.html`)
}

function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
}
