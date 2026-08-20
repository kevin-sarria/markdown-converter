import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { CONTENT_IMAGE_MAX_DIMENSION, optimizeImageFile } from '../lib/imageOptimize'
import { rectInContainer } from '../lib/overlayPosition'
import type { CanvasEditor } from '../hooks/useCanvasEditor'

/**
 * What you get when you click an empty spot on a canvas page: the two things
 * you can put there. Both land exactly where the click was rather than in a
 * fixed corner, so placing something is one gesture instead of "insert, then
 * drag it off whatever it landed on".
 */
export default function CanvasPageMenu({
  editor,
  containerRef,
}: {
  editor: CanvasEditor
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { page } = editor
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!page || !container) {
      setPosition(null)
      return
    }
    const rect = rectInContainer(page.canvas, container)
    setPosition({
      top: rect.top + (rect.height * page.at.y) / 100,
      left: rect.left + (rect.width * page.at.x) / 100,
    })
  }, [page, containerRef])

  if (!page || !position) return null

  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 rounded-md border border-white/10 bg-[#111219] px-1 py-0.5 shadow-lg"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <button
        type="button"
        title="Añadir un bloque de texto aquí"
        onClick={editor.addTextItem}
        className="flex h-6 items-center rounded px-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
      >
        ＋ Texto
      </button>
      <button
        type="button"
        title="Añadir una imagen aquí"
        onClick={() => fileRef.current?.click()}
        className="flex h-6 items-center rounded px-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
      >
        ＋ Imagen
      </button>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          editor.addImageItem(await optimizeImageFile(file, { maxDimension: CONTENT_IMAGE_MAX_DIMENSION }))
        }}
      />
    </div>
  )
}
