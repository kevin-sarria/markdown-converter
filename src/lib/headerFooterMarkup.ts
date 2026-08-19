import { formatPageNumber, type HeaderFooterSettings, type WatermarkSettings } from './headerFooter'

/**
 * Shared HTML string builders for the header/footer bands and watermark overlay,
 * used both by PreviewPane (via dangerouslySetInnerHTML) and the standalone HTML
 * export, so alignment/logo/opacity logic only lives in one place.
 *
 * These render a single, non-repeating instance (no browser-side pagination is
 * available outside the PDF export path — see exportPdf.ts / pdfHeaderFooter.ts
 * for the per-page version used in the actual PDF).
 */

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

function alignToJustify(align: 'left' | 'center' | 'right'): string {
  return align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
}

function bandHtml(className: string, text: string, align: 'left' | 'center' | 'right', logoDataUrl: string | null, logoWidthMm: number): string {
  const logo = logoDataUrl
    ? `<img class="md-hf-logo" src="${escapeHtml(logoDataUrl)}" style="width: ${logoWidthMm}mm;" alt="logo" />`
    : ''
  const textEl = text ? `<span class="md-hf-text" style="text-align: ${align === 'center' ? 'center' : align};">${escapeHtml(text)}</span>` : ''
  return `<div class="${className}" style="justify-content: ${alignToJustify(align)};">${logo}${textEl}</div>`
}

export function renderHeaderBandHtml(hf: HeaderFooterSettings): string {
  if (!hf.enabled || (!hf.headerText && !hf.logoDataUrl)) return ''
  return bandHtml('md-header-band', hf.headerText, hf.headerAlign, hf.logoDataUrl, hf.logoWidthMm)
}

export function renderFooterBandHtml(hf: HeaderFooterSettings): string {
  if (!hf.enabled) return ''
  const pageNote = hf.showPageNumber ? formatPageNumber(hf.pageNumberFormat, 1, 1) : ''
  const text = [hf.footerText, pageNote].filter(Boolean).join('  ·  ')
  if (!text) return ''
  return bandHtml('md-footer-band', text, hf.footerAlign, null, hf.logoWidthMm)
}

export function renderWatermarkHtml(wm: WatermarkSettings): string {
  if (!wm.enabled) return ''
  if (wm.type === 'image' && wm.imageDataUrl) {
    return `<div class="md-watermark" style="opacity: ${wm.opacity};"><img class="md-watermark-img" src="${escapeHtml(wm.imageDataUrl)}" alt="marca de agua" style="transform: rotate(${wm.rotationDeg}deg);" /></div>`
  }
  if (wm.type === 'text' && wm.text) {
    return `<div class="md-watermark" style="opacity: ${wm.opacity};"><span class="md-watermark-text" style="font-size: ${wm.fontSizePt}pt; color: ${escapeHtml(wm.color)}; transform: rotate(${wm.rotationDeg}deg);">${escapeHtml(wm.text)}</span></div>`
  }
  return ''
}
