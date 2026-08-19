import { forwardRef, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { renderCoverPageHtml, renderHeaderBandHtml, renderFooterBandHtml, renderWatermarkHtml } from '../lib/headerFooterMarkup'
import { renderMarkdownToHtml } from '../lib/markdown'
import { insertPageBreakBeforeLine, removeMarkedLine } from '../lib/pageBreaks'
import { buildPreviewVars } from '../lib/previewStyle'
import type { DocSettings } from '../lib/settings'

interface PreviewPaneProps {
  markdown: string
  settings: DocSettings
  onMarkdownChange: (markdown: string) => void
}

interface HoverTarget {
  line: number
  isBreak: boolean
  top: number
  left: number
  width: number
}

/**
 * The forwarded ref points at the exact DOM node used for PDF export (the
 * content-only .md-preview node) — header/footer bands, the cover page, and the
 * watermark are rendered as siblings around it, purely for on-screen WYSIWYG
 * feedback. The real per-page PDF header/footer/watermark/cover is drawn
 * separately by jsPDF at export time (see exportPdf.ts), since this preview
 * isn't paginated.
 *
 * On narrow screens the page (a real mm-sized document) is wider than the
 * viewport, so it's visually scaled down to fit with a CSS transform on the
 * .md-page-wrap wrapper. This is purely cosmetic: exportToPdf clones the
 * ref'd #export-target node into a fresh, untransformed off-screen container
 * before rasterizing it, so the on-screen zoom never touches the export.
 *
 * Clicking a block in the rendered result adds/removes a page break there —
 * every top-level block is tagged with a `data-line` attribute (its source line,
 * from markdown-it's token.map, see markdown.ts) so a click can be translated
 * back into an edit of the underlying Markdown text (see pageBreaks.ts).
 */
const PreviewPane = forwardRef<HTMLDivElement, PreviewPaneProps>(function PreviewPane(
  { markdown, settings, onMarkdownChange },
  ref,
) {
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown])
  const vars = useMemo(() => buildPreviewVars(settings), [settings])
  const coverHtml = useMemo(() => renderCoverPageHtml(settings.coverPage), [settings.coverPage])
  const headerHtml = useMemo(() => renderHeaderBandHtml(settings.headerFooter), [settings.headerFooter])
  const footerHtml = useMemo(() => renderFooterBandHtml(settings.headerFooter), [settings.headerFooter])
  const watermarkHtml = useMemo(() => renderWatermarkHtml(settings.watermark), [settings.watermark])

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)
  const [hover, setHover] = useState<HoverTarget | null>(null)

  useEffect(() => {
    const container = containerRef.current
    const page = pageRef.current
    if (!container || !page) return

    const update = () => {
      const containerWidth = container.clientWidth - 32
      setPageSize({ width: page.offsetWidth, height: page.offsetHeight })
      setScale(page.offsetWidth > 0 ? Math.min(1, containerWidth / page.offsetWidth) : 1)
    }
    update()

    const ro = new ResizeObserver(update)
    ro.observe(container)
    ro.observe(page)
    return () => ro.disconnect()
  }, [html, vars, headerHtml, footerHtml, coverHtml])

  const handleMouseMove = (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement
    if (target.closest('.md-pagebreak-affordance')) return

    const block = target.closest<HTMLElement>('[data-line]')
    const container = containerRef.current
    if (!block || !container) {
      setHover(null)
      return
    }

    const blockRect = block.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    setHover({
      line: Number(block.getAttribute('data-line')),
      isBreak: block.hasAttribute('data-page-break'),
      top: blockRect.top - containerRect.top + container.scrollTop,
      left: blockRect.left - containerRect.left + container.scrollLeft,
      width: blockRect.width,
    })
  }

  const handleAffordanceClick = () => {
    if (!hover) return
    const next = hover.isBreak ? removeMarkedLine(markdown, hover.line) : insertPageBreakBeforeLine(markdown, hover.line)
    onMarkdownChange(next)
    setHover(null)
  }

  return (
    <div
      ref={containerRef}
      className="relative flex w-full min-w-0 justify-center overflow-x-auto py-8 px-4"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHover(null)}
      onScroll={() => setHover(null)}
    >
      {hover && (
        <button
          type="button"
          className="md-pagebreak-affordance"
          style={{ top: hover.top - 14, left: hover.left + hover.width / 2 - 14 }}
          onClick={handleAffordanceClick}
          title={hover.isBreak ? 'Quitar salto de página' : 'Insertar salto de página aquí'}
        >
          {hover.isBreak ? '×' : '+'}
        </button>
      )}
      <div style={{ width: pageSize.width * scale || undefined, height: pageSize.height * scale || undefined }}>
        <div ref={pageRef} className="md-page-wrap page-shell" style={{ ...vars, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {coverHtml && <div dangerouslySetInnerHTML={{ __html: coverHtml }} />}
          {headerHtml && <div dangerouslySetInnerHTML={{ __html: headerHtml }} />}
          <div
            ref={ref}
            id="export-target"
            className="md-preview"
            style={vars}
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {footerHtml && <div dangerouslySetInnerHTML={{ __html: footerHtml }} />}
          {watermarkHtml && <div dangerouslySetInnerHTML={{ __html: watermarkHtml }} />}
        </div>
      </div>
    </div>
  )
})

export default PreviewPane
