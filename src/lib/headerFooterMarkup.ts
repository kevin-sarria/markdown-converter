import type { CoverPageSettings } from './coverPage'
import { formatPageNumber, type HFAlign, type HeaderFooterSettings, type WatermarkSettings } from './headerFooter'
import { groupLogosByAlign, type LogoItem } from './logos'

/**
 * Shared HTML string builders for the cover page, header/footer bands, and
 * watermark overlay, used both by PreviewPane (via dangerouslySetInnerHTML) and
 * the standalone HTML export, so alignment/logo/opacity logic only lives in one
 * place.
 *
 * These render a single, non-repeating instance (no browser-side pagination is
 * available outside the PDF export path — see exportPdf.ts / pdfHeaderFooter.ts /
 * pdfCoverPage.ts for the per-page version used in the actual PDF).
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

function alignToJustify(align: HFAlign): string {
  return align === 'left' ? 'flex-start' : align === 'right' ? 'flex-end' : 'center'
}

function logoImgHtml(logo: LogoItem): string {
  return `<img class="md-hf-logo" src="${escapeHtml(logo.dataUrl)}" style="width: ${logo.widthMm}mm;" alt="logo" />`
}

/** Renders a left/center/right group of logos, one <span> per slot. */
function logoGroupsHtml(logos: LogoItem[], extra?: Partial<Record<HFAlign, string>>): string {
  const groups = groupLogosByAlign(logos)
  return (['left', 'center', 'right'] as const)
    .map((align) => {
      const content = groups[align].map(logoImgHtml).join('') + (extra?.[align] ?? '')
      return `<span class="md-hf-slot md-hf-slot--${align}">${content}</span>`
    })
    .join('')
}

export function renderHeaderBandHtml(hf: HeaderFooterSettings): string {
  if (!hf.enabled || (!hf.headerText && hf.logos.length === 0)) return ''
  const textHtml = hf.headerText
    ? `<span class="md-hf-text" style="text-align: ${hf.headerAlign};">${escapeHtml(hf.headerText)}</span>`
    : ''
  return `<div class="md-header-band">${logoGroupsHtml(hf.logos, { [hf.headerAlign]: textHtml })}</div>`
}

export function renderFooterBandHtml(hf: HeaderFooterSettings): string {
  if (!hf.enabled) return ''
  const pageNote = hf.showPageNumber ? formatPageNumber(hf.pageNumberFormat, 1, 1) : ''
  const text = [hf.footerText, pageNote].filter(Boolean).join('  ·  ')
  if (!text) return ''
  const textEl = `<span class="md-hf-text" style="text-align: ${hf.footerAlign};">${escapeHtml(text)}</span>`
  return `<div class="md-footer-band" style="justify-content: ${alignToJustify(hf.footerAlign)};">${textEl}</div>`
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

/** A full page-sized block (reuses the --p-width/--p-height vars from its ancestor), followed by a forced page break. */
export function renderCoverPageHtml(cover: CoverPageSettings): string {
  if (!cover.enabled || (!cover.title && !cover.subtitle && cover.logos.length === 0)) return ''

  const logosHtml = cover.logos.length > 0 ? `<div class="md-cover-logos">${logoGroupsHtml(cover.logos)}</div>` : ''
  const titleHtml = cover.title ? `<h1 class="md-cover-title">${escapeHtml(cover.title)}</h1>` : ''
  const subtitleHtml = cover.subtitle ? `<p class="md-cover-subtitle">${escapeHtml(cover.subtitle)}</p>` : ''

  return `<div class="md-cover-page">${logosHtml}<div class="md-cover-body">${titleHtml}${subtitleHtml}</div></div><div class="page-break" data-page-break></div>`
}
