import html2pdf from 'html2pdf.js'
import type { jsPDF } from 'jspdf'
import { renderMarkdownToHtml } from './markdown'
import { drawCoverPage } from './pdfCoverPage'
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

/**
 * Mounts `node` off-screen inside a `height:0; overflow:hidden` wrapper, ready
 * for html2pdf/html2canvas to capture. `node` itself is left in normal static
 * flow — this html2pdf version's document-clone capture measures a zero height
 * for anything given `position: fixed/absolute` (even far off-screen), so that
 * common "hide it at left:-10000px" trick silently produces an empty PDF. Only
 * the wrapper is hidden, which doesn't have this problem.
 */
function mountOffscreen(node: HTMLElement): HTMLElement {
  const wrapper = document.createElement('div')
  wrapper.style.height = '0'
  wrapper.style.overflow = 'hidden'
  wrapper.appendChild(node)
  document.body.appendChild(wrapper)
  return wrapper
}

/**
 * Clones a content node into an off-screen, PDF-specific copy (zero vertical CSS
 * padding — see pdfOptions above). The `pdf-export` class hides the on-screen page-
 * break divider/label (see .pdf-export .page-break in preview.css) while keeping
 * the underlying `break-before: page` that actually splits the PDF.
 */
function preparePdfNode(source: HTMLElement, settings: DocSettings): HTMLElement {
  const clone = source.cloneNode(true) as HTMLElement
  const vars = buildPreviewVarsCss(settings, { pdfMode: true })
  clone.setAttribute('style', `${clone.getAttribute('style') ?? ''}; ${vars}`)
  clone.classList.add('pdf-export')
  return clone
}

export async function exportToPdf(
  node: HTMLElement,
  settings: DocSettings,
  fileName: string,
): Promise<void> {
  const pdfNode = preparePdfNode(node, settings)
  const wrapper = mountOffscreen(pdfNode)
  try {
    const worker = html2pdf().set(pdfOptions(settings, fileName)).from(pdfNode).toPdf()
    await worker.get('pdf').then((pdf: jsPDF) => {
      const startPage = drawCoverPage(pdf, settings)
      applyHeaderFooterWatermark(pdf, settings, startPage)
    })
    await worker.save()
  } finally {
    document.body.removeChild(wrapper)
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
  node.className = 'md-preview pdf-export'
  node.setAttribute('style', buildPreviewVarsCss(settings, { pdfMode: true }))
  node.innerHTML = renderMarkdownToHtml(markdown)
  const wrapper = mountOffscreen(node)

  try {
    const worker = html2pdf().set(pdfOptions(settings, fileName)).from(node).toPdf()
    await worker.get('pdf').then((pdf: jsPDF) => {
      const startPage = drawCoverPage(pdf, settings)
      applyHeaderFooterWatermark(pdf, settings, startPage)
    })
    const blob = (await worker.outputPdf('blob')) as Blob
    return blob
  } finally {
    document.body.removeChild(wrapper)
  }
}
