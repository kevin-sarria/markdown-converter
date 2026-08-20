import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ClipboardEvent as ReactClipboardEvent,
} from 'react'
import EditorToolbar from './EditorToolbar'
import { renderHeaderBandHtml, renderFooterBandHtml, renderWatermarkHtml } from '../lib/headerFooterMarkup'
import { fileToDataUrl } from '../lib/headerFooter'
import { useEditableMarkdown, type EditableMarkdownRegion } from '../hooks/useEditableMarkdown'
import { buildPreviewVars } from '../lib/previewStyle'
import type { DocSettings } from '../lib/settings'

interface PreviewPaneProps {
  markdown: string
  settings: DocSettings
  onMarkdownChange: (markdown: string) => void
  onCoverContentChange: (content: string) => void
}

/**
 * The forwarded ref points at the exact DOM node used for PDF export (the
 * content-only .md-preview node) — header/footer bands and the watermark are
 * rendered as siblings around it, purely for on-screen WYSIWYG feedback. The
 * real per-page PDF header/footer/watermark is drawn separately by jsPDF at
 * export time (see exportPdf.ts), since this preview isn't paginated. The
 * cover page (when enabled) IS captured together with the body for PDF —
 * see the comment in exportPdf.ts for why.
 *
 * On narrow screens the page (a real mm-sized document) is wider than the
 * viewport, so it's visually scaled down to fit with a CSS transform on the
 * .md-page-wrap wrapper. This is purely cosmetic: exportToPdf clones the
 * ref'd #export-target node into a fresh, untransformed off-screen container
 * before rasterizing it, so the on-screen zoom never touches the export.
 *
 * Both the cover and the body are directly editable (Word-style, via
 * EditorToolbar and useEditableMarkdown — see that hook for how the cursor
 * survives re-renders). They're two independent regions; `activeEditableRef`
 * tracks whichever one was last focused, so the single shared toolbar always
 * acts on the right one.
 */
const PreviewPane = forwardRef<HTMLDivElement, PreviewPaneProps>(function PreviewPane(
  { markdown, settings, onMarkdownChange, onCoverContentChange },
  ref,
) {
  const cover = settings.coverPage
  const vars = useMemo(() => buildPreviewVars(settings), [settings])
  const headerHtml = useMemo(() => renderHeaderBandHtml(settings.headerFooter), [settings.headerFooter])
  const footerHtml = useMemo(() => renderFooterBandHtml(settings.headerFooter), [settings.headerFooter])
  const watermarkHtml = useMemo(() => renderWatermarkHtml(settings.watermark), [settings.watermark])

  const body = useEditableMarkdown(markdown, onMarkdownChange)
  const coverRegion = useEditableMarkdown(cover.content, onCoverContentChange)

  useImperativeHandle(ref, () => body.elRef.current as HTMLDivElement)

  const containerRef = useRef<HTMLDivElement>(null)
  const pageRef = useRef<HTMLDivElement>(null)
  const [pageSize, setPageSize] = useState({ width: 0, height: 0 })
  const [scale, setScale] = useState(1)

  // Whichever editable region was last focused — defaults to the body so the
  // toolbar has something sensible to act on before the user clicks anywhere.
  const activeEditableRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    activeEditableRef.current = body.elRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
  }, [markdown, vars, headerHtml, footerHtml, cover.enabled, cover.content])

  const handleToolbarEdited = () => {
    if (activeEditableRef.current === coverRegion.elRef.current) coverRegion.handleInput()
    else body.handleInput()
  }

  const insertImageIntoRegion = async (region: EditableMarkdownRegion, file: File) => {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await fileToDataUrl(file)
    region.elRef.current?.focus()
    document.execCommand('insertImage', false, dataUrl)
    region.syncNow()
  }

  const makeDropHandler = (region: EditableMarkdownRegion) => (e: ReactDragEvent<HTMLDivElement>) => {
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    e.preventDefault()
    insertImageIntoRegion(region, file)
  }

  const makePasteHandler = (region: EditableMarkdownRegion) => (e: ReactClipboardEvent<HTMLDivElement>) => {
    const item = Array.from(e.clipboardData.items).find((it) => it.type.startsWith('image/'))
    const file = item?.getAsFile()
    if (!file) return
    e.preventDefault()
    insertImageIntoRegion(region, file)
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <EditorToolbar editableRef={activeEditableRef} onEdited={handleToolbarEdited} />
      <div ref={containerRef} className="flex w-full min-w-0 flex-1 justify-center overflow-x-auto py-8 px-4">
        <div style={{ width: pageSize.width * scale || undefined, height: pageSize.height * scale || undefined }}>
          <div ref={pageRef} className="md-page-wrap page-shell" style={{ ...vars, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            {cover.enabled && (
              <>
                <div
                  ref={coverRegion.elRef}
                  className="md-preview md-cover-page"
                  style={vars}
                  contentEditable
                  suppressContentEditableWarning
                  data-placeholder="Escribí el contenido de tu portada aquí…"
                  onFocus={() => (activeEditableRef.current = coverRegion.elRef.current)}
                  onInput={coverRegion.handleInput}
                  onBlur={coverRegion.handleBlur}
                  onDrop={makeDropHandler(coverRegion)}
                  onDragOver={(e) => e.preventDefault()}
                  onPaste={makePasteHandler(coverRegion)}
                />
                <div className="page-break" data-page-break />
              </>
            )}
            {headerHtml && <div dangerouslySetInnerHTML={{ __html: headerHtml }} />}
            <div
              ref={body.elRef}
              id="export-target"
              className="md-preview"
              style={vars}
              contentEditable
              suppressContentEditableWarning
              onFocus={() => (activeEditableRef.current = body.elRef.current)}
              onInput={body.handleInput}
              onBlur={body.handleBlur}
              onDrop={makeDropHandler(body)}
              onDragOver={(e) => e.preventDefault()}
              onPaste={makePasteHandler(body)}
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
