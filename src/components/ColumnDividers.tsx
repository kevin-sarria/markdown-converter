import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { widthsAfterDrag } from '../lib/columns'
import { applyWidths, columnsOfRow, readWidths } from '../lib/columnsDom'
import { rectInContainer } from '../lib/overlayPosition'
import type { RowSelection } from '../hooks/useColumnsRow'

interface DividerPosition {
  top: number
  left: number
  height: number
}

/**
 * The drag handles that live in the gaps of the selected row, letting the user
 * hand width from one column to its neighbour.
 *
 * Two details make the drag feel right. First, only the two columns either side
 * of the handle move — the rest of the row stays put, so a wide row doesn't
 * shuffle under the cursor. Second, the delta is measured against the summed
 * width of the columns, not the row's outer width: the flex gaps between them
 * aren't part of what the percentages divide, and counting them would make the
 * column drift behind the pointer.
 *
 * Markdown is written once, on mouse-up. Writing on every mousemove would run
 * the whole HTML→Markdown→render cycle dozens of times a second for a gesture
 * with one meaningful outcome.
 */
export default function ColumnDividers({
  selection,
  containerRef,
}: {
  selection: RowSelection | null
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const [positions, setPositions] = useState<DividerPosition[]>([])
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null)
  const dragRef = useRef<{ index: number; startX: number; widths: number[]; usableWidth: number } | null>(null)

  // Re-read the layout on every drag tick so the handles track the columns.
  const [tick, setTick] = useState(0)
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!selection || !container) {
      setPositions([])
      return
    }

    const columns = columnsOfRow(selection.row)
    const rowRect = rectInContainer(selection.row, container)

    setPositions(
      columns.slice(0, -1).map((column, i) => {
        const left = rectInContainer(column, container).right
        const right = rectInContainer(columns[i + 1], container).left
        return { top: rowRect.top, left: (left + right) / 2 - 4.5, height: rowRect.height }
      }),
    )
  }, [selection, containerRef, tick])

  useLayoutEffect(() => {
    if (!selection) return

    const handleMouseMove = (e: MouseEvent) => {
      const drag = dragRef.current
      if (!drag) return

      const deltaPercent = ((e.clientX - drag.startX) / drag.usableWidth) * 100
      const [left, right] = widthsAfterDrag(drag.widths[drag.index], drag.widths[drag.index + 1], deltaPercent)

      const next = [...drag.widths]
      next[drag.index] = left
      next[drag.index + 1] = right
      applyWidths(selection.row, next)
      setTick((n) => n + 1)
    }

    const handleMouseUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setDraggingIndex(null)
      selection.syncNow()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selection])

  if (!selection) return null

  return (
    <>
      {positions.map((position, i) => (
        <div
          key={i}
          className={`md-col-divider${draggingIndex === i ? ' is-dragging' : ''}`}
          style={{ top: position.top, left: position.left, height: position.height }}
          title="Arrastrá para repartir el ancho"
          onMouseDown={(e) => {
            e.preventDefault()
            const columns = columnsOfRow(selection.row)
            dragRef.current = {
              index: i,
              startX: e.clientX,
              widths: readWidths(selection.row),
              usableWidth: columns.reduce((total, c) => total + c.getBoundingClientRect().width, 0),
            }
            setDraggingIndex(i)
          }}
        />
      ))}
    </>
  )
}
