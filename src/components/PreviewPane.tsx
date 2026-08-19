import { forwardRef, useMemo } from 'react'
import { renderHeaderBandHtml, renderFooterBandHtml, renderWatermarkHtml } from '../lib/headerFooterMarkup'
import { renderMarkdownToHtml } from '../lib/markdown'
import { buildPreviewVars } from '../lib/previewStyle'
import type { DocSettings } from '../lib/settings'

interface PreviewPaneProps {
  markdown: string
  settings: DocSettings
}

/**
 * The forwarded ref points at the exact DOM node used for PDF export (the
 * content-only .md-preview node) — header/footer bands and the watermark are
 * rendered as siblings around it, purely for on-screen WYSIWYG feedback. The
 * real per-page PDF header/footer/watermark is drawn separately by jsPDF at
 * export time (see exportPdf.ts), since this preview isn't paginated.
 */
const PreviewPane = forwardRef<HTMLDivElement, PreviewPaneProps>(function PreviewPane(
  { markdown, settings },
  ref,
) {
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown])
  const vars = useMemo(() => buildPreviewVars(settings), [settings])
  const headerHtml = useMemo(() => renderHeaderBandHtml(settings.headerFooter), [settings.headerFooter])
  const footerHtml = useMemo(() => renderFooterBandHtml(settings.headerFooter), [settings.headerFooter])
  const watermarkHtml = useMemo(() => renderWatermarkHtml(settings.watermark), [settings.watermark])

  return (
    <div className="flex justify-center overflow-x-auto py-8 px-4">
      <div className="md-page-wrap page-shell" style={vars}>
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
  )
})

export default PreviewPane
