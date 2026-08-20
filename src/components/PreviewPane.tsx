import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type DragEvent as ReactDragEvent,
  type ClipboardEvent as ReactClipboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react'
import CanvasItemMenu from './CanvasItemMenu'
import CanvasOverlay from './CanvasOverlay'
import ColumnDividers from './ColumnDividers'
import ColumnsRowMenu from './ColumnsRowMenu'
import EditorToolbar from './EditorToolbar'
import ImageResizeHandle from './ImageResizeHandle'
import { renderHeaderBandHtml, renderFooterBandHtml, renderWatermarkHtml } from '../lib/headerFooterMarkup'
import { buildRowHtml } from '../lib/columns'
import { buildStarterCanvas, canvasOf, itemOf } from '../lib/canvasDom'
import { dropBeside, isColumnsRow, removeImageBlock, rowOf } from '../lib/columnsDom'
import { CONTENT_IMAGE_MAX_DIMENSION, optimizeImageFile } from '../lib/imageOptimize'
import { useCanvasEditor } from '../hooks/useCanvasEditor'
import { useColumnsRow } from '../hooks/useColumnsRow'
import { useEditableMarkdown, type EditableMarkdownRegion } from '../hooks/useEditableMarkdown'
import { useImageSelection } from '../hooks/useImageSelection'
import { useImageSideDrop } from '../hooks/useImageSideDrop'
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
 * survives re-renders). They're two independent regions; `activeRegionRef`
 * tracks whichever one was last focused, so the single shared toolbar always
 * acts on the right one.
 *
 * This component is deliberately a composition root: the editing behaviours it
 * offers (image selection and resizing, columns rows, dragging an image beside
 * another) each live in their own hook, and the editing chrome they need is
 * drawn as absolutely-positioned overlays outside the page so none of it can
 * end up in an export.
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

  const image = useImageSelection()
  const columnsRow = useColumnsRow()
  const canvas = useCanvasEditor()
  const sideDrop = useImageSideDrop(containerRef)

  // Whichever editable region was last focused — defaults to the body so the
  // toolbar has something sensible to act on before the user clicks anywhere.
  const activeRegionRef = useRef<EditableMarkdownRegion>(body)
  const activeEditableRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    activeRegionRef.current = body
    activeEditableRef.current = body.elRef.current
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const focusRegion = (region: EditableMarkdownRegion) => {
    activeRegionRef.current = region
    activeEditableRef.current = region.elRef.current
  }

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

  const handleToolbarEdited = () => activeRegionRef.current.handleInput()

  const handleInsertColumns = (count: number) => {
    const region = activeRegionRef.current
    region.elRef.current?.focus()
    // An empty paragraph per column so the caret has somewhere to land, and one
    // after the row so there's a way out of it — the same trick the page-break
    // button uses.
    const columns = Array.from({ length: count }, () => ({ widthPercent: null, html: '<p><br></p>' }))
    document.execCommand('insertHTML', false, `${buildRowHtml(columns)}<p><br></p>`)
    region.syncNow()
  }

  const handleInsertCanvas = (region: EditableMarkdownRegion = activeRegionRef.current) => {
    region.elRef.current?.focus()
    document.execCommand('insertHTML', false, `${buildStarterCanvas()}<p><br></p>`)
    region.syncNow()
  }

  // Clicking an image selects it (shows the resize handle); clicking inside a
  // columns row selects the row (shows its menu and dividers); clicking
  // anywhere else clears both.
  const makeClickHandler = (region: EditableMarkdownRegion) => (e: ReactMouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement

    // A click that landed on a canvas page was already handled on mousedown by
    // the canvas editor; the flowing-content selections must not fight it.
    if (canvasOf(target)) return

    canvas.select(null)
    image.selectFrom(target, region.syncNow)

    const row = rowOf(target)
    columnsRow.select(isColumnsRow(row) ? { row, syncNow: region.syncNow } : null)
  }

  const makeMouseDownHandler = (region: EditableMarkdownRegion) => (e: ReactMouseEvent<HTMLDivElement>) => {
    const item = itemOf(e.target as HTMLElement)
    const page = item && canvasOf(item)
    if (item && page) canvas.handleItemMouseDown(e, { item, canvas: page, syncNow: region.syncNow })
  }

  const handleDoubleClick = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (itemOf(e.target as HTMLElement)) canvas.beginTextEditing()
  }

  const insertImageIntoRegion = async (region: EditableMarkdownRegion, file: File) => {
    if (!file.type.startsWith('image/')) return
    const dataUrl = await optimizeImageFile(file, { maxDimension: CONTENT_IMAGE_MAX_DIMENSION })
    region.elRef.current?.focus()
    document.execCommand('insertImage', false, dataUrl)
    region.syncNow()
  }

  /**
   * A drop can mean three different things, and they're distinguished here
   * rather than in the hooks: land beside an image (creating or extending a
   * columns row), insert a dropped file at the caret, or nothing at all.
   *
   * Both `clientX/Y` and the dropped file are read before the first `await` —
   * after it the browser has already cleared the DataTransfer.
   */
  const makeDropHandler = (region: EditableMarkdownRegion) => async (e: ReactDragEvent<HTMLDivElement>) => {
    const { clientX, clientY } = e
    const file = e.dataTransfer.files?.[0]
    const target = sideDrop.targetAt(clientX, clientY)
    const dragged = sideDrop.draggedImage()
    const root = region.elRef.current

    if (target && root && (file || dragged)) {
      // Cancels the browser's own drag-and-drop move inside the contentEditable,
      // which would otherwise fight with the surgery below.
      e.preventDefault()

      let incoming: string | null = null
      if (file) {
        if (file.type.startsWith('image/')) {
          const dataUrl = await optimizeImageFile(file, { maxDimension: CONTENT_IMAGE_MAX_DIMENSION })
          incoming = `<p><img src="${dataUrl}"></p>`
        }
      } else if (dragged && root.contains(dragged)) {
        // Read the markup before removing it, and remove it before inserting,
        // so the image never exists twice in the document.
        incoming = `<p>${dragged.outerHTML}</p>`
        removeImageBlock(dragged, root)
      }

      if (incoming) {
        dropBeside(target, incoming, root)
        region.syncNow()
      }
      sideDrop.clear()
      return
    }

    sideDrop.clear()
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

  const editableProps = (region: EditableMarkdownRegion) => ({
    contentEditable: true,
    suppressContentEditableWarning: true,
    onFocus: () => focusRegion(region),
    onInput: region.handleInput,
    onBlur: region.handleBlur,
    onMouseDown: makeMouseDownHandler(region),
    onDoubleClick: handleDoubleClick,
    onDragStart: sideDrop.handleDragStart,
    onDragOver: (e: ReactDragEvent<HTMLDivElement>) => {
      e.preventDefault() // required for the drop to be allowed at all
      sideDrop.handleDragOver(e)
    },
    onDragLeave: sideDrop.handleDragLeave,
    onDrop: makeDropHandler(region),
    onPaste: makePasteHandler(region),
    onClick: makeClickHandler(region),
  })

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-col">
      <EditorToolbar
        editableRef={activeEditableRef}
        onEdited={handleToolbarEdited}
        onInsertColumns={handleInsertColumns}
        onInsertCanvas={() => handleInsertCanvas()}
      />
      <div ref={containerRef} className="relative flex w-full min-w-0 flex-1 justify-center overflow-x-auto py-8 px-4">
        <div style={{ width: pageSize.width * scale || undefined, height: pageSize.height * scale || undefined }}>
          <div ref={pageRef} className="md-page-wrap page-shell" style={{ ...vars, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
            {cover.enabled && (
              <>
                <div
                  ref={coverRegion.elRef}
                  className="md-preview md-cover-page"
                  style={vars}
                  data-placeholder="Escribí el contenido de tu portada aquí…"
                  {...editableProps(coverRegion)}
                />
                <div className="page-break" data-page-break />
              </>
            )}
            {headerHtml && <div dangerouslySetInnerHTML={{ __html: headerHtml }} />}
            <div ref={body.elRef} id="export-target" className="md-preview" style={vars} {...editableProps(body)} />
            {footerHtml && <div dangerouslySetInnerHTML={{ __html: footerHtml }} />}
            {watermarkHtml && <div dangerouslySetInnerHTML={{ __html: watermarkHtml }} />}
          </div>
        </div>

        {/* Editing chrome — positioned over the page, never part of it. */}
        <ImageResizeHandle selection={image.selection} scale={scale} containerRef={containerRef} />
        <ColumnsRowMenu controller={columnsRow} containerRef={containerRef} />
        <ColumnDividers selection={columnsRow.selection} containerRef={containerRef} />
        <CanvasOverlay editor={canvas} containerRef={containerRef} />
        <CanvasItemMenu editor={canvas} containerRef={containerRef} />
        {sideDrop.guide && (
          <div
            className="md-side-drop-guide"
            style={{ top: sideDrop.guide.top, left: sideDrop.guide.left, height: sideDrop.guide.height }}
          />
        )}
      </div>
    </div>
  )
})

export default PreviewPane
