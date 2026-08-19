import html2pdf from 'html2pdf.js'
import type { jsPDF } from 'jspdf'
import { renderMarkdownToHtml } from './markdown'
import { applyHeaderFooterWatermark } from './pdfHeaderFooter'
import { buildPreviewVarsCss } from './previewStyle'
import type { DocSettings } from './settings'
import { MARGINS } from './themes'

/**
 * html2pdf/html2canvas renders the whole document as one tall image and slices
 * it into page-height chunks — there's no real per-page layout. CSS padding
 * baked into the content only shows up at the very top of page 1 and the very
 * bottom of the last page, not on pages in between. Passing the vertical margin
 * here (html2pdf's own `margin` option) instead reduces every slice's height
 * uniformly and offsets every slice's placement by the same amount, so every
 * physical PDF page ends up with a blank `marginMm` band top and bottom — which
 * is what makes a header/footer/watermark that repeats on every page possible
 * (drawn afterwards with jsPDF, in applyHeaderFooterWatermark). Left/right
 * margin stays as CSS padding on the content, since a vertical-only slice
 * already repeats it on every page for free.
 */
function pdfOptions(settings: DocSettings, fileName: string) {
  const marginMm = MARGINS[settings.margin].mm
  return {
    margin: [marginMm, 0, marginMm, 0] as [number, number, number, number],
    filename: `${fileName}.pdf`,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    },
    jsPDF: {
      unit: 'mm',
      format: settings.pageSize,
      orientation: 'portrait' as const,
    },
    pagebreak: { mode: ['css', 'avoid-all'] },
  }
}

/** Clones a content node into an off-screen, PDF-specific copy (zero vertical CSS padding — see pdfOptions above), ready to hand to html2pdf. */
function preparePdfNode(source: HTMLElement, settings: DocSettings): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const vars = buildPreviewVarsCss(settings, { pdfMode: true })
  clone.setAttribute('style', `${clone.getAttribute('style') ?? ''}; ${vars}`)
  clone.style.position = 'fixed'
  clone.style.left = '-10000px'
  clone.style.top = '0'
  document.body.appendChild(clone)
  return clone
}

export async function exportToPdf(
  node: HTMLElement,
  settings: DocSettings,
  fileName: string,
): Promise<void> {
  const pdfNode = preparePdfNode(node, settings)
  try {
    const worker = html2pdf().set(pdfOptions(settings, fileName)).from(pdfNode).toPdf()
    await worker.get('pdf').then((pdf: jsPDF) => applyHeaderFooterWatermark(pdf, settings))
    await worker.save()
  } finally {
    document.body.removeChild(pdfNode)
  }
}

/**
 * Renders markdown off-screen (reusing the same .md-preview styling as the live
 * preview, via the globally-loaded preview.css) and returns the resulting PDF as
 * a blob, without touching the visible DOM. Used for batch export of files that
 * aren't the currently active/previewed document.
 */
export async function buildPdfBlob(
  markdown: string,
  settings: DocSettings,
  fileName: string,
): Promise<Blob> {
  const node = document.createElement('div')
  node.className = 'md-preview'
  node.setAttribute('style', buildPreviewVarsCss(settings, { pdfMode: true }))
  node.innerHTML = renderMarkdownToHtml(markdown)
  node.style.position = 'fixed'
  node.style.left = '-10000px'
  node.style.top = '0'
  document.body.appendChild(node)

  try {
    const worker = html2pdf().set(pdfOptions(settings, fileName)).from(node).toPdf()
    await worker.get('pdf').then((pdf: jsPDF) => applyHeaderFooterWatermark(pdf, settings))
    const blob = (await worker.outputPdf('blob')) as Blob
    return blob
  } finally {
    document.body.removeChild(node)
  }
}
