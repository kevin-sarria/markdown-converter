import { GState, type jsPDF } from 'jspdf'
import { formatPageNumber, type HeaderFooterSettings, type WatermarkSettings } from './headerFooter'
import type { DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

/**
 * Draws the header/footer bands and watermark on every page of an already-built
 * jsPDF document (all pages must already exist — call after html2pdf's
 * `.toPdf()`). Each PDF page has a blank `marginMm`-tall band at the top and
 * bottom because exportPdf.ts passes `margin: [marginMm, 0, marginMm, 0]` to
 * html2pdf, which (unlike CSS padding baked into the content) repeats on every
 * sliced page — see the header comment in exportPdf.ts.
 */
export function applyHeaderFooterWatermark(pdf: jsPDF, settings: DocSettings): void {
  const { headerFooter: hf, watermark: wm } = settings
  if (!hf.enabled && !wm.enabled) return

  const page = PAGE_SIZES[settings.pageSize]
  const marginMm = MARGINS[settings.margin].mm
  const pageCount = pdf.getNumberOfPages()

  for (let p = 1; p <= pageCount; p++) {
    pdf.setPage(p)
    const isFirstPage = p === 1
    if (hf.enabled && (!isFirstPage || hf.showOnFirstPage)) {
      drawHeader(pdf, hf, page.widthMm, marginMm)
      drawFooter(pdf, hf, page.widthMm, page.heightMm, marginMm, p, pageCount)
    }
    if (wm.enabled) {
      drawWatermark(pdf, wm, page.widthMm, page.heightMm)
    }
  }
}

function alignX(align: 'left' | 'center' | 'right', pageWidthMm: number, marginMm: number): { x: number; opt: { align: 'left' | 'center' | 'right' } } {
  if (align === 'left') return { x: marginMm, opt: { align: 'left' } }
  if (align === 'right') return { x: pageWidthMm - marginMm, opt: { align: 'right' } }
  return { x: pageWidthMm / 2, opt: { align: 'center' } }
}

function drawHeader(pdf: jsPDF, hf: HeaderFooterSettings, pageWidthMm: number, marginMm: number): void {
  const bandY = marginMm / 2
  let textStartX = marginMm

  if (hf.logoDataUrl) {
    try {
      const props = pdf.getImageProperties(hf.logoDataUrl)
      const w = hf.logoWidthMm
      const h = (props.height / props.width) * w
      const y = Math.max(1, bandY - h / 2)
      pdf.addImage(hf.logoDataUrl, props.fileType, marginMm, y, w, h)
      textStartX = marginMm + w + 3
    } catch {
      /* ignore unreadable logo */
    }
  }

  if (hf.headerText) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(90, 90, 90)
    const align = hf.headerAlign
    const { x, opt } =
      align === 'left' ? { x: textStartX, opt: { align: 'left' as const } } : alignX(align, pageWidthMm, marginMm)
    pdf.text(hf.headerText, x, bandY, { ...opt, baseline: 'middle' })
  }
}

function drawFooter(
  pdf: jsPDF,
  hf: HeaderFooterSettings,
  pageWidthMm: number,
  pageHeightMm: number,
  marginMm: number,
  pageNum: number,
  pageCount: number,
): void {
  const bandY = pageHeightMm - marginMm / 2
  const parts = [hf.footerText, hf.showPageNumber ? formatPageNumber(hf.pageNumberFormat, pageNum, pageCount) : '']
    .filter(Boolean)
    .join('   ·   ')
  if (!parts) return

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(9)
  pdf.setTextColor(90, 90, 90)
  const { x, opt } = alignX(hf.footerAlign, pageWidthMm, marginMm)
  pdf.text(parts, x, bandY, { ...opt, baseline: 'middle' })
}

function drawWatermark(pdf: jsPDF, wm: WatermarkSettings, pageWidthMm: number, pageHeightMm: number): void {
  const cx = pageWidthMm / 2
  const cy = pageHeightMm / 2

  pdf.saveGraphicsState()
  pdf.setGState(new GState({ opacity: wm.opacity }))

  if (wm.type === 'image' && wm.imageDataUrl) {
    try {
      const props = pdf.getImageProperties(wm.imageDataUrl)
      const maxW = pageWidthMm * 0.6
      const maxH = pageHeightMm * 0.6
      const scale = Math.min(maxW / props.width, maxH / props.height)
      const w = props.width * scale
      const h = props.height * scale
      pdf.addImage(wm.imageDataUrl, props.fileType, cx - w / 2, cy - h / 2, w, h)
    } catch {
      /* ignore unreadable watermark image */
    }
  } else if (wm.type === 'text' && wm.text) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(wm.fontSizePt)
    pdf.setTextColor(wm.color)
    pdf.text(wm.text, cx, cy, { align: 'center', baseline: 'middle', angle: wm.rotationDeg })
  }

  pdf.restoreGraphicsState()
}
