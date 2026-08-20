import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react'
import EditableText from './EditableText'
import EditorToolbar from './EditorToolbar'
import { logoGroupsHtml, renderHeaderBandHtml, renderFooterBandHtml, renderWatermarkHtml } from '../lib/headerFooterMarkup'
import { fileToDataUrl } from '../lib/headerFooter'
import { htmlToMarkdown } from '../lib/htmlToMarkdown'
import { renderMarkdownToHtml } from '../lib/markdown'
import { buildPreviewVars } from '../lib/previewStyle'
import type { CoverPageSettings } from '../lib/coverPage'
import type { DocSettings } from '../lib/settings'

interface PreviewPaneProps {
  markdown: string
  settings: DocSettings
  onMarkdownChange: (markdown: string) => void
  onCoverPageChange: (patch: Partial<CoverPageSettings>) => void
}

const SYNC_DEBOUNCE_MS = 400

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
 * #export-target is directly editable (Word-style, via EditorToolbar) — typing,
 * formatting, dropping/pasting images, and inserting page breaks all happen
 * right here. Markdown stays the single source of truth: edits get converted
 * back with htmlToMarkdown() and pushed up through onMarkdownChange, the exact
 * same prop the plain-text Markdown editor uses, so both panels drive the same
 * state and every exporter keeps reading plain Markdown as before.
 *
 * The tricky part is not fighting the cursor: this node's contents are written
 * imperatively (a useEffect doing `el.innerHTML = ...`), not via React's
 * dangerouslySetInnerHTML, and skipNextSyncRef distinguishes "this change came
 * from typing right here, the DOM is already correct, don't touch it" from
 * "this change came from the plain-text editor / a file upload, re-render the
 * HTML from scratch." Rewriting a focused contentEditable's innerHTML on every
 * keystroke would otherwise reset the cursor to the start on every keystroke.
 */
const PreviewPane = forwardRef<HTMLDivElement, PreviewPaneProps>(function PreviewPane(
  { markdown, settings, onMarkdownChange, onCoverPageChange },
  ref,
) {
  const cover = settings.coverPage
  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown])
  const vars = useMemo(() => buildPreviewVars(settings), [settings])
  const coverLogosHtml = useMemo(() => logoGroupsHtml(cover.logos), [cover.logos])
  const headerHtml = useMemo(() => renderHeaderBandHtml(settings.headerFooter), [settings.headerFooter])
  const footerHtml = useMemo(() => renderFooterBandHtml(settings.headerFooter), [settings.headerFooter])
  const watermarkHtml = useMemo(() => renderWatermarkHtml(settings.watermark), [settings.watermark])

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const exportTargetRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)

  useImperativeHandle(ref, () => exportTargetRef.current as HTMLDivElement)

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
  }, [html, vars, headerHtml, footerHtml, cover.enabled, cover.title, cover.subtitle, coverLogosHtml])

  // Imperative content sync — see the component doc comment above for why.
  const skipNextSyncRef = useRef(false)
  useEffect(() => {
    const el = exportTargetRef.current
    if (!el) return
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    el.innerHTML = html
  }, [html])

  const syncFromDom = useCallback(() => {
    const el = exportTargetRef.current
    if (!el) return
    const newMarkdown = htmlToMarkdown(el.innerHTML)
    if (newMarkdown === markdown) return
    skipNextSyncRef.current = true
    onMarkdownChange(newMarkdown)
  }, [markdown, onMarkdownChange])

  const debounceRef = useRef<number | undefined>(undefined)
  const handleInput = () => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(syncFromDom, SYNC_DEBOUNCE_MS)
  }
  const handleBlur = () => {
    window.clearTimeout(debounceRef.current)
    syncFromDom()
  }

  const insertImageAtCursor = async (file: File) => {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await fileToDataUrl(file)
    exportTargetRef.current?.focus()
    document.execCommand('insertImage', false, dataUrl)
    syncFromDom()
  }

  const handleDrop = (e: ReactDragEvent<HTMLDivElement>) => {
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    e.preventDefault()
    insertImageAtCursor(file)
  }

  const handlePaste = (e: ReactClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (!file) return
    e.preventDefault()
    insertImageAtCursor(file)
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <EditorToolbar editableRef={exportTargetRef} onEdited={handleInput} />
      <div ref={containerRef} className="flex w-full min-w-0 flex-1 justify-center overflow-x-auto py-8 px-4">
        <div style={{ width: pageSize.width * scale || undefined, height: pageSize.height * scale || undefined }}>
          <div ref={pageRef} className="md-page-wrap page-shell" style={{ ...vars, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            {/* Shown whenever the cover is turned on, even with nothing typed yet —
                unlike the export paths (headerFooterMarkup.ts's renderCoverPageHtml,
                pdfCoverPage.ts, docxHeaderFooter.ts), which skip a genuinely empty
                cover, this needs to render blank so there's something to click into. */}
            {cover.enabled && (
              <>
                <div className="md-cover-page">
                  {cover.logos.length > 0 && (
                    <div className="md-cover-logos" dangerouslySetInnerHTML={{ __html: coverLogosHtml }} />
                  )}
                  <div className="md-cover-body">
                    <EditableText
                      as="h1"
                      className="md-cover-title"
                      value={cover.title}
                      placeholder="Título del documento"
                      onChange={(title) => onCoverPageChange({ title })}
                    />
                    <EditableText
                      as="p"
                      className="md-cover-subtitle"
                      value={cover.subtitle}
                      placeholder="Subtítulo, fecha, autor…"
                      onChange={(subtitle) => onCoverPageChange({ subtitle })}
                    />
                  </div>
                </div>
                <div className="page-break" data-page-break />
              </>
            )}
            {headerHtml && <div dangerouslySetInnerHTML={{ __html: headerHtml }} />}
            <div
              ref={exportTargetRef}
              id="export-target"
              className="md-preview"
              style={vars}
              contentEditable
              suppressContentEditableWarning
              onInput={handleInput}
              onBlur={handleBlur}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onPaste={handlePaste}
            />
            {footerHtml && <div dangerouslySetInnerHTML={{ __html: footerHtml }} />}
            {watermarkHtml && <div dangerouslySetInnerHTML={{ __html: watermarkHtml }} />}
          </div>
        </div>
      </div>
    </div>
  )
})

export default PreviewPane
