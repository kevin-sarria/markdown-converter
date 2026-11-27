import html2canvas from 'html2canvas'
import html2pdf from 'html2pdf.js'
import { jsPDF } from 'jspdf'
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
      unit: 'mm' as const,
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

const BULLETS: Record<string, string> = { disc: '•', circle: '◦', square: '▪' }

function orderedMarker(n: number, type: string): string {
  if (type === 'lower-alpha' || type === 'upper-alpha') {
    let s = ''
    for (let v = n; v > 0; v = Math.floor((v - 1) / 26)) s = String.fromCharCode(97 + ((v - 1) % 26)) + s
    return `${type === 'upper-alpha' ? s.toUpperCase() : s}.`
  }
  return `${n}.`
}

/**
 * Turns every list marker of the PDF copy into real text. html2canvas paints
 * `::marker` with its own vertical formula, which put the step numbers of a
 * manual well above their line ("¹·Abra la dirección…"). As a real <span> the
 * number is laid out by the browser and drawn like any other text, on the same
 * baseline. Needs the node mounted, to read each list's computed style; the
 * on-screen preview is untouched, only the export copy changes.
 */
function materializeListMarkers(root: HTMLElement) {
  root.querySelectorAll('ol, ul').forEach((list) => {
    const style = getComputedStyle(list)
    const type = style.listStyleType
    if (type === 'none') return
    const ordered = list.tagName === 'OL'
    let n = ordered ? (list as HTMLOListElement).start || 1 : 0
    for (const li of Array.from(list.children)) {
      if (li.tagName !== 'LI') continue
      const value = Number(li.getAttribute('value'))
      if (ordered && value) n = value
      const marker = document.createElement('span')
      marker.className = 'md-li-marker'
      marker.textContent = ordered ? orderedMarker(n, type) : (BULLETS[type] ?? '•')
      // A loose list wraps each item in <p>, whose top margin would leave a
      // marker anchored to the <li> floating above the text.
      const first = li.firstElementChild
      const host = first && first.tagName === 'P' && li.firstChild === first ? first : li
      host.classList.add('md-li-marker-host')
      host.prepend(marker)
      n++
    }
    list.classList.add('md-list-materialized')
  })
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
    // A couple mm short of the full page-content band on purpose: at exactly
    // one page, the forced .page-break right after it lands precisely on the
    // next page boundary, and html2pdf's pagebreak plugin reads that as
    // "already there" and pads in a whole *extra* blank page before actually
    // breaking. Coming in just under the boundary keeps the break landing on
    // page 2 like it should, with no visible gap (the cover barely notices).
    coverEl.style.height = `${page.heightMm - marginMm * 2 - 2}mm`
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

/**
 * Tallest strip, in device pixels, captured in one html2canvas pass. Browsers
 * refuse canvases past a size limit (Chrome: 65 535px tall; Firefox: 32 767px;
 * Safari also caps the total area) and hand back a BLANK canvas instead of an
 * error. html2pdf captures the whole document as one canvas, so a long manual
 * (01a: 37 290 CSS px × scale 2 = 74 580px) came out as 45 white pages. Capturing
 * a few pages at a time keeps every canvas well under every browser's limit.
 */
const MAX_STRIP_HEIGHT_PX = 16384

interface PageSize {
  k: number
  inner: { width: number; height: number; ratio: number }
}

/**
 * Builds the PDF from `exportRoot` page by page instead of through html2pdf's
 * single full-document canvas (see MAX_STRIP_HEIGHT_PX).
 *
 * html2pdf still lays the document out: `toContainer()` clones it at the page's
 * inner width and its pagebreak plugin pushes `.page-break` / avoid-all elements
 * onto the next page. Only the capture changes — each strip is an exact whole
 * number of pages, cut at the same pixel rows html2pdf's own toPdf would use, so
 * the pages come out identical to before, just without the size ceiling.
 *
 * html2pdf adds clickable links in its toPdf, which is skipped here, so they are
 * re-added at the end the same way its hyperlinks plugin does.
 */
async function renderPdf(exportRoot: HTMLElement, settings: DocSettings, fileName: string): Promise<jsPDF> {
  const opts = pdfOptions(settings, fileName)
  const worker = html2pdf().set(opts).from(exportRoot).toContainer()
  const container = (await worker.get('container')) as HTMLElement
  const overlay = (await worker.get('overlay')) as HTMLElement
  const pageSize = (await worker.get('pageSize')) as PageSize

  try {
    const scale = opts.html2canvas.scale
    const containerRect = container.getBoundingClientRect()
    const cssWidth = container.offsetWidth
    const cssHeight = container.scrollHeight
    const pxWidth = Math.floor(cssWidth * scale)
    const pxPageHeight = Math.floor(pxWidth * pageSize.inner.ratio)
    const pxFullHeight = Math.floor(cssHeight * scale)
    const nPages = Math.max(1, Math.ceil(pxFullHeight / pxPageHeight))
    const pagesPerStrip = Math.max(1, Math.floor(MAX_STRIP_HEIGHT_PX / pxPageHeight))

    const pdf = new jsPDF(opts.jsPDF)
    const pageCanvas = document.createElement('canvas')
    const pageCtx = pageCanvas.getContext('2d')
    if (!pageCtx) throw new Error('No se pudo crear el lienzo para el PDF.')

    for (let first = 0; first < nPages; first += pagesPerStrip) {
      const count = Math.min(pagesPerStrip, nPages - first)
      const yCss = (first * pxPageHeight) / scale
      const heightCss = Math.min((count * pxPageHeight) / scale, cssHeight - yCss)
      // x/y are offsets from the element's own top-left corner (html2canvas
      // adds the element's bounds to them).
      const strip = await html2canvas(container, { ...opts.html2canvas, y: yCss, height: heightCss, width: cssWidth })

      for (let i = 0; i < count; i++) {
        const top = i * pxPageHeight
        const h = Math.min(pxPageHeight, strip.height - top)
        if (h <= 0) break
        pageCanvas.width = strip.width
        pageCanvas.height = h
        pageCtx.fillStyle = 'white'
        pageCtx.fillRect(0, 0, strip.width, h)
        pageCtx.drawImage(strip, 0, top, strip.width, h, 0, 0, strip.width, h)

        if (first + i > 0) pdf.addPage()
        // A short last page keeps its real height instead of being stretched.
        const heightMm = h === pxPageHeight ? pageSize.inner.height : (h * pageSize.inner.width) / strip.width
        const imgData = pageCanvas.toDataURL(`image/${opts.image.type}`, opts.image.quality)
        pdf.addImage(imgData, opts.image.type.toUpperCase(), opts.margin[1], opts.margin[0], pageSize.inner.width, heightMm)
      }
      // Free the strip's pixels before capturing the next one.
      strip.width = 0
      strip.height = 0
    }

    addLinks(pdf, container, containerRect, pageSize, opts.margin)
    return pdf
  } finally {
    overlay.remove()
  }
}

/** Same placement html2pdf's hyperlinks plugin uses: every rect of every <a>. */
function addLinks(
  pdf: jsPDF,
  container: HTMLElement,
  containerRect: DOMRect,
  pageSize: PageSize,
  margin: [number, number, number, number],
) {
  const toUnit = (px: number) => (px * 72) / 96 / pageSize.k
  const nPages = pdf.getNumberOfPages()
  container.querySelectorAll('a[href]').forEach((link) => {
    const href = (link as HTMLAnchorElement).href
    for (const r of Array.from(link.getClientRects())) {
      const top = toUnit(r.top - containerRect.top)
      const page = Math.floor(top / pageSize.inner.height) + 1
      if (page > nPages) continue
      pdf.setPage(page)
      pdf.link(
        margin[1] + toUnit(r.left - containerRect.left),
        margin[0] + (top % pageSize.inner.height),
        toUnit(r.width),
        toUnit(r.height),
        { url: href },
      )
    }
  })
  pdf.setPage(nPages)
}

async function buildPdf(exportRoot: HTMLElement, settings: DocSettings, fileName: string): Promise<jsPDF> {
  const pdf = await renderPdf(exportRoot, settings, fileName)
  const startPage = hasCoverContent(settings.coverPage) ? 2 : 1
  applyHeaderFooterWatermark(pdf, settings, startPage)
  return pdf
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
    materializeListMarkers(exportRoot)
    const pdf = await buildPdf(exportRoot, settings, fileName)
    pdf.save(`${fileName}.pdf`)
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
    materializeListMarkers(exportRoot)
    const pdf = await buildPdf(exportRoot, settings, fileName)
    return pdf.output('blob')
  } finally {
    document.body.removeChild(wrapper)
  }
}
