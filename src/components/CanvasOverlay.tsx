import { useLayoutEffect, useState, type RefObject } from 'react'
import { rectInContainer } from '../lib/overlayPosition'
import type { CanvasEditor, ResizeCorner } from '../hooks/useCanvasEditor'

const CORNERS: { corner: ResizeCorner; cursor: string }[] = [
  { corner: 'nw', cursor: 'nwse-resize' },
  { corner: 'ne', cursor: 'nesw-resize' },
  { corner: 'sw', cursor: 'nesw-resize' },
  { corner: 'se', cursor: 'nwse-resize' },
]

interface Box {
  top: number
  left: number
  width: number
  height: number
}

/**
 * The grips on the selected canvas item and the alignment guides that appear
 * while it is being dragged.
 *
 * Drawn over the page rather than inside it (see overlayPosition.ts), so none
 * of this can end up in an exported document. The guides are what tell the user
 * *why* the item just jumped — that it lined up with the page centre, or with
 * the logo beside it — instead of the movement feeling like a glitch.
 */
export default function CanvasOverlay({
  editor,
  containerRef,
}: {
  editor: CanvasEditor
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { selection, guides, dragging, editingText } = editor
  const [item, setItem] = useState<Box | null>(null)
  const [page, setPage] = useState<Box | null>(null)

  // Re-measure while dragging: the item moves under the grips on every frame.
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!selection || !container) {
      setItem(null)
      setPage(null)
      return
    }

    let frame = 0
    const measure = () => {
      setItem(rectInContainer(selection.item, container))
      setPage(rectInContainer(selection.canvas, container))
      if (dragging) frame = requestAnimationFrame(measure)
    }
    measure()
    return () => cancelAnimationFrame(frame)
  }, [selection, containerRef, dragging])

  if (!selection || !item || !page) return null

  return (
    <>
      {guides.map((guide, i) => (
        <div
          key={i}
          className="md-canvas-guide"
          style={
            guide.axis === 'x'
              ? { left: page.left + (page.width * guide.at) / 100, top: page.top, width: 1, height: page.height }
              : { left: page.left, top: page.top + (page.height * guide.at) / 100, width: page.width, height: 1 }
          }
        />
      ))}

      {/* While typing, the grips would just be in the way of the text. */}
      {!editingText &&
        CORNERS.map(({ corner, cursor }) => (
          <div
            key={corner}
            className="md-canvas-grip"
            style={{
              cursor,
              left: (corner === 'nw' || corner === 'sw' ? item.left : item.left + item.width) - 5,
              top: (corner === 'nw' || corner === 'ne' ? item.top : item.top + item.height) - 5,
            }}
            onMouseDown={(e) => editor.handleGripMouseDown(e, corner)}
          />
        ))}
    </>
  )
}
