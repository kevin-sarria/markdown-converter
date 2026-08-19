import { GState, type jsPDF } from 'jspdf'
import { formatPageNumber, type HeaderFooterSettings, type WatermarkSettings } from './headerFooter'
import { groupLogosByAlign, type LogoAlign, type LogoItem } from './logos'
import type { DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

const LOGO_GAP_MM = 3

/**
 * Draws the header/footer bands and watermark on every page of an already-built
 * jsPDF document, starting at `startPage` (page 2 when a cover page was inserted
 * as page 1 — see pdfCoverPage.ts). All pages must already exist — call after
 * html2pdf's `.toPdf()`. Each PDF page has a blank `marginMm`-tall band at the top
 * and bottom because exportPdf.ts passes `margin: [marginMm, 0, marginMm, 0]` to
 * html2pdf, which (unlike CSS padding baked into the content) repeats on every
 * sliced page — see the header comment in exportPdf.ts.
 */
export function applyHeaderFooterWatermark(pdf: jsPDF, settings: DocSettings, startPage = 1): void {
  const { headerFooter: hf, watermark: wm } = settings
  if (!hf.enabled && !wm.enabled) return

  const page = PAGE_SIZES[settings.pageSize]
  const marginMm = MARGINS[settings.margin].mm
  const pageCount = pdf.getNumberOfPages()

  for (let p = startPage; p <= pageCount; p++) {
    pdf.setPage(p)
    const isFirstContentPage = p === startPage
    if (hf.enabled && (!isFirstContentPage || hf.showOnFirstPage)) {
      drawHeader(pdf, hf, page.widthMm, marginMm)
      drawFooter(pdf, hf, page.widthMm, page.heightMm, marginMm, p - startPage + 1, pageCount - startPage + 1)
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

/**
 * Draws a horizontal row of logos anchored at `anchorX` (left edge, right edge, or
 * center, depending on `align`), vertically centered on `centerY`. Returns the
 * total width the row occupies, so callers can place adjacent text without
 * overlapping. Shared by the header band and the cover page.
 */
export function drawLogoGroup(pdf: jsPDF, logos: LogoItem[], align: LogoAlign, anchorX: number, centerY: number): number {
  const items = logos
    .map((logo) => {
      try {
        const props = pdf.getImageProperties(logo.dataUrl)
        const w = logo.widthMm
        const h = (props.height / props.width) * w
        return { logo, fileType: props.fileType, w, h }
      } catch {
        return null
      }
    })
    .filter((item) => item !== null)

  if (items.length === 0) return 0

  const totalWidth = items.reduce((sum, item) => sum + item.w, 0) + LOGO_GAP_MM * (items.length - 1)
  let x = align === 'left' ? anchorX : align === 'right' ? anchorX - totalWidth : anchorX - totalWidth / 2

  for (const item of items) {
    pdf.addImage(item.logo.dataUrl, item.fileType, x, centerY - item.h / 2, item.w, item.h)
    x += item.w + LOGO_GAP_MM
  }

  return totalWidth
}

function drawHeader(pdf: jsPDF, hf: HeaderFooterSettings, pageWidthMm: number, marginMm: number): void {
  const bandY = marginMm / 2
  const groups = groupLogosByAlign(hf.logos)
  const leftWidth = drawLogoGroup(pdf, groups.left, 'left', marginMm, bandY)
  const rightWidth = drawLogoGroup(pdf, groups.right, 'right', pageWidthMm - marginMm, bandY)
  drawLogoGroup(pdf, groups.center, 'center', pageWidthMm / 2, bandY)

  if (hf.headerText) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(9)
    pdf.setTextColor(90, 90, 90)

    if (hf.headerAlign === 'left') {
      const x = marginMm + (leftWidth > 0 ? leftWidth + LOGO_GAP_MM : 0)
      pdf.text(hf.headerText, x, bandY, { align: 'left', baseline: 'middle' })
    } else if (hf.headerAlign === 'right') {
      const x = pageWidthMm - marginMm - (rightWidth > 0 ? rightWidth + LOGO_GAP_MM : 0)
      pdf.text(hf.headerText, x, bandY, { align: 'right', baseline: 'middle' })
    } else {
      pdf.text(hf.headerText, pageWidthMm / 2, bandY, { align: 'center', baseline: 'middle' })
    }
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
