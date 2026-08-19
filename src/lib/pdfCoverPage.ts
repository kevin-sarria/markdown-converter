import type { jsPDF } from 'jspdf'
import { hasCoverContent } from './coverPage'
import { groupLogosByAlign } from './logos'
import { drawLogoGroup } from './pdfHeaderFooter'
import type { DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

/**
 * Inserts a leading cover page (page 1) drawn with jsPDF, ahead of the content
 * pages html2pdf already built. Returns the page number content should now start
 * on (2 if a cover was drawn, 1 otherwise) — pass this to applyHeaderFooterWatermark
 * so the cover never gets a repeating header/footer/watermark.
 */
export function drawCoverPage(pdf: jsPDF, settings: DocSettings): number {
  const cover = settings.coverPage
  if (!hasCoverContent(cover)) return 1

  pdf.insertPage(1)
  const page = PAGE_SIZES[settings.pageSize]
  const marginMm = MARGINS[settings.margin].mm
  const cx = page.widthMm / 2
  const contentWidth = page.widthMm - marginMm * 2

  if (cover.logos.length > 0) {
    const logoY = marginMm + 20
    const groups = groupLogosByAlign(cover.logos)
    drawLogoGroup(pdf, groups.left, 'left', marginMm, logoY)
    drawLogoGroup(pdf, groups.right, 'right', page.widthMm - marginMm, logoY)
    drawLogoGroup(pdf, groups.center, 'center', cx, logoY)
  }

  const titleY = page.heightMm / 2
  if (cover.title) {
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(28)
    pdf.setTextColor(30, 30, 30)
    pdf.text(cover.title, cx, titleY, { align: 'center', baseline: 'middle', maxWidth: contentWidth })
  }
  if (cover.subtitle) {
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(14)
    pdf.setTextColor(90, 90, 90)
    pdf.text(cover.subtitle, cx, titleY + 14, { align: 'center', baseline: 'middle', maxWidth: contentWidth })
  }

  return 2
}
