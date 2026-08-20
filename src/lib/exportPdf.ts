import html2pdf from 'html2pdf.js'
import type { jsPDF } from 'jspdf'
import { hasCoverContent } from './coverPage'
import { applyHeaderFooterWatermark } from './pdfHeaderFooter'
import { renderMarkdownToHtml } from './markdown'
import { buildPreviewVarsCss } from './previewStyle'
import type { DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

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
 * Prepares a content node (body clone or freshly-built) for PDF capture: zero
 * vertical CSS padding (see pdfOptions above — html2pdf's own margin handles
 * it instead), and strips `contenteditable` since the export is a static
 * snapshot.
 */
function preparePdfBodyNode(node: HTMLElement, settings: DocSettings): HTMLElement {
  const vars = buildPreviewVarsCss(settings, { pdfMode: true })
  node.setAttribute('style', `${node.getAttribute('style') ?? ''}; ${vars}`)
  node.removeAttribute('contenteditable')
  return node
}

/**
 * Builds the root html2pdf actually captures: the cover page (if any) + a
 * forced page break + the document body. The cover is real Markdown content
 * (see coverPage.ts), so unlike the header/footer/watermark — which are drawn
 * separately with jsPDF after capture, since they must repeat on every page —
 * it has to be part of the same captured image html2canvas rasterizes, sliced
 * by the same `.page-break` mechanism as any other forced break in the body.
 *
 * The cover is clamped to exactly one physical page's worth of content height
 * (pageHeight minus the top+bottom margin band html2pdf carves out of every
 * page — see pdfOptions above), so `applyHeaderFooterWatermark` can reliably
 * start repeating on page 2 without having to measure anything.
 */
function buildPdfExportRoot(bodyNode: HTMLElement, settings: DocSettings): HTMLElement {
  const root = document.createElement('div')
  root.className = 'pdf-export'

  const cover = settings.coverPage
  if (hasCoverContent(cover)) {
    const marginMm = MARGINS[settings.margin].mm
    const page = PAGE_SIZES[settings.pageSize]
    const coverEl = document.createElement('div')
    coverEl.className = 'md-preview md-cover-page'
    coverEl.setAttribute('style', buildPreviewVarsCss(settings, { pdfMode: true }))
    coverEl.style.height = `${page.heightMm - marginMm * 2}mm`
    coverEl.innerHTML = renderMarkdownToHtml(cover.content)
    root.appendChild(coverEl)

    const breakEl = document.createElement('div')
    breakEl.className = 'page-break'
    breakEl.setAttribute('data-page-break', '')
    root.appendChild(breakEl)
  }

  root.appendChild(bodyNode)
  return root
}

export async function exportToPdf(
  node: HTMLElement,
  settings: DocSettings,
  fileName: string,
): Promise<void> {
  const bodyNode = preparePdfBodyNode(node.cloneNode(true) as HTMLElement, settings)
  const exportRoot = buildPdfExportRoot(bodyNode, settings)
  const wrapper = mountOffscreen(exportRoot)
  try {
    const worker = html2pdf().set(pdfOptions(settings, fileName)).from(exportRoot).toPdf()
    await worker.get('pdf').then((pdf: jsPDF) => {
      const startPage = hasCoverContent(settings.coverPage) ? 2 : 1
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
  node.className = 'md-preview'
  node.innerHTML = renderMarkdownToHtml(markdown)
  const bodyNode = preparePdfBodyNode(node, settings)
  const exportRoot = buildPdfExportRoot(bodyNode, settings)
  const wrapper = mountOffscreen(exportRoot)

  try {
    const worker = html2pdf().set(pdfOptions(settings, fileName)).from(exportRoot).toPdf()
    await worker.get('pdf').then((pdf: jsPDF) => {
      const startPage = hasCoverContent(settings.coverPage) ? 2 : 1
      applyHeaderFooterWatermark(pdf, settings, startPage)
    })
    const blob = (await worker.outputPdf('blob')) as Blob
    return blob
  } finally {
    document.body.removeChild(wrapper)
  }
}
