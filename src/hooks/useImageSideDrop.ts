import { useCallback, useRef, useState, type DragEvent as ReactDragEvent, type RefObject } from 'react'
import type { SideDropTarget } from '../lib/columnsDom'
import { rectInContainer } from '../lib/overlayPosition'

/** How much of an image's width counts as its "beside me" edge, each side. */
const EDGE_FRACTION = 0.25
/** …but never a target so thin it can't be hit on a small image. */
const MIN_EDGE_PX = 14

export interface SideDropGuide {
  top: number
  left: number
  height: number
}

export interface ImageSideDrop {
  guide: SideDropGuide | null
  handleDragStart: (e: ReactDragEvent<HTMLElement>) => void
  handleDragOver: (e: ReactDragEvent<HTMLElement>) => void
  handleDragLeave: () => void
  /** The image edge under this point, if any — read fresh at drop time. */
  targetAt: (x: number, y: number) => SideDropTarget | null
  /** The image being dragged from inside the document, if the drag started here. */
  draggedImage: () => HTMLImageElement | null
  clear: () => void
}

/**
 * Dragging an image onto the left or right edge of another one, to put the two
 * side by side — the gesture people already know from Notion and Word.
 *
 * The edge is found with elementFromPoint rather than the event target: inside
 * a contentEditable the target during a drag is whatever node the browser
 * decided the caret is nearest, which is frequently not the image the pointer
 * is actually over.
 *
 * This hook only decides *where* the drop would land and draws the guide. The
 * document surgery lives in columnsDom (dropBeside / removeImageBlock), where
 * it can be tested without a pointer.
 */
export function useImageSideDrop(containerRef: RefObject<HTMLDivElement | null>): ImageSideDrop {
  const draggedRef = useRef<HTMLImageElement | null>(null)
  const [guide, setGuide] = useState<SideDropGuide | null>(null)

  const targetAt = useCallback((x: number, y: number): SideDropTarget | null => {
    const element = document.elementFromPoint(x, y)
    if (!element || element.tagName !== 'IMG') return null

    const img = element as HTMLImageElement
    if (img === draggedRef.current) return null

    const rect = img.getBoundingClientRect()
    const edge = Math.max(MIN_EDGE_PX, rect.width * EDGE_FRACTION)
    if (x <= rect.left + edge) return { img, side: 'left' }
    if (x >= rect.right - edge) return { img, side: 'right' }
    return null
  }, [])

  const handleDragStart = useCallback((e: ReactDragEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    draggedRef.current = target.tagName === 'IMG' ? (target as HTMLImageElement) : null
  }, [])

  const handleDragOver = useCallback(
    (e: ReactDragEvent<HTMLElement>) => {
      const container = containerRef.current
      const target = targetAt(e.clientX, e.clientY)
      if (!target || !container) {
        setGuide(null)
        return
      }

      const rect = rectInContainer(target.img, container)
      setGuide({
        top: rect.top,
        left: target.side === 'left' ? rect.left - 7 : rect.right + 4,
        height: rect.height,
      })
    },
    [containerRef, targetAt],
  )

  const clear = useCallback(() => {
    draggedRef.current = null
    setGuide(null)
  }, [])

  return {
    guide,
    handleDragStart,
    handleDragOver,
    handleDragLeave: useCallback(() => setGuide(null), []),
    targetAt,
    draggedImage: useCallback(() => draggedRef.current, []),
    clear,
  }
}
