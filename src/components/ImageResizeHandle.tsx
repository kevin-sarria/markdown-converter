import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { withImageWidthFragment } from '../lib/imageWidth'

export interface ImageSelection {
  img: HTMLImageElement
  /** Called once the resize is done, to persist the new width into Markdown. */
  syncNow: () => void
}

interface ImageResizeHandleProps {
  selection: ImageSelection | null
  /** The current on-screen zoom-to-fit scale (see PreviewPane.tsx) — a screen-pixel
   * drag delta has to be divided by this to get the real (unscaled) width change. */
  scale: number
  containerRef: RefObject<HTMLDivElement | null>
}

const MIN_WIDTH_PX = 40

/**
 * The real (unscaled) width currently applied to the image: prefer the
 * explicit inline style set by a previous drag over getBoundingClientRect().
 * The rect can come back smaller than that style value — `.md-preview img`
 * has `max-width: 100%`, which visually caps an image wider than its column
 * without touching `style.width` — so measuring the rect after a drag would
 * silently save the *clamped* size instead of the one actually dragged to,
 * and PDF/DOCX (re-rendered fresh from that saved width) would then disagree
 * with what the editor showed. Falls back to the rect only for an image that
 * has never been explicitly resized yet.
 */
function currentRealWidth(img: HTMLImageElement, scale: number): number {
  const styleWidth = Number.parseFloat(img.style.width)
  if (!Number.isNaN(styleWidth)) return styleWidth
  return img.getBoundingClientRect().width / scale
}

/**
 * A single drag handle at the bottom-right corner of the selected image,
 * letting the user resize it directly (Word-style) instead of it being stuck
 * at whatever size it was inserted at. The chosen width is stored on the
 * image itself as a `#w=NNN` fragment on its `src` (see imageWidth.ts) so it
 * survives the round-trip back to Markdown.
 */
export default function ImageResizeHandle({ selection, scale, containerRef }: ImageResizeHandleProps) {
  const draggingRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  // Recomputes the handle's position from the selected image's live rect.
  // Reading layout via refs belongs in an effect, not render, so this also
  // re-runs on every drag tick (bumped by the mousemove handler below).
  const [tick, setTick] = useState(0)
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!selection || !container) {
      setPosition(null)
      return
    }
    const imgRect = selection.img.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    setPosition({
      top: imgRect.bottom - containerRect.top + container.scrollTop - 7,
      left: imgRect.right - containerRect.left + container.scrollLeft - 7,
    })
  }, [selection, containerRef, tick])

  useLayoutEffect(() => {
    if (!selection) return

    const handleMouseMove = (e: MouseEvent) => {
      const drag = draggingRef.current
      if (!drag) return
      const deltaPx = (e.clientX - drag.startX) / scale
      const newWidth = Math.max(MIN_WIDTH_PX, Math.round(drag.startWidth + deltaPx))
      selection.img.style.width = `${newWidth}px`
      selection.img.style.height = 'auto'
      setTick((n) => n + 1) // reposition the handle as the image resizes
    }

    const handleMouseUp = () => {
      if (!draggingRef.current) return
      draggingRef.current = null
      const finalWidth = Math.round(currentRealWidth(selection.img, scale))
      selection.img.src = withImageWidthFragment(selection.img.src, finalWidth)
      selection.syncNow()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [selection, scale])

  if (!selection || !position) return null

  return (
    <div
      className="md-image-resize-handle"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => {
        e.preventDefault()
        draggingRef.current = { startX: e.clientX, startWidth: currentRealWidth(selection.img, scale) }
      }}
      title="Arrastrá para cambiar el tamaño"
    />
  )
}
