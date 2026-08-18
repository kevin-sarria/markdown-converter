import { forwardRef, useMemo } from 'react'
import { renderMarkdownToHtml } from '../lib/markdown'
import { buildPreviewVars } from '../lib/previewStyle'
import type { DocSettings } from '../lib/settings'

interface PreviewPaneProps {
  markdown: string
  settings: DocSettings
}

/**
 * The forwarded ref points at the exact DOM node used for PDF export,
 * so what you see is exactly what gets exported.
 */
const PreviewPane = forwardRef<HTMLDivElement, PreviewPaneProps>(function PreviewPane(
  { markdown, settings },
  ref,
) {
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown])
  const vars = useMemo(() => buildPreviewVars(settings), [settings])

  return (
    <div className="flex justify-center py-8 px-4">
      <div
        ref={ref}
        id="export-target"
        className="md-preview page-shell"
        style={vars}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
})

export default PreviewPane
