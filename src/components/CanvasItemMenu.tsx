import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import CanvasStyleBar from './CanvasStyleBar'
import { rectInContainer } from '../lib/overlayPosition'
import type { DocSettings } from '../lib/settings'
import type { CanvasEditor } from '../hooks/useCanvasEditor'

function MenuButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: () => void
  title: string
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium ${
        danger ? 'text-red-300 hover:bg-red-500/20' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * The floating controls for the selected canvas item: text editing, stacking
 * order, and delete.
 *
 * Delete lives here rather than on the Delete key on purpose. The key is
 * ambiguous the moment an item has text in it — inside the text it should
 * remove a character, outside it the whole box — and getting that wrong throws
 * away a block the editor has no undo for.
 */
export default function CanvasItemMenu({
  editor,
  containerRef,
  settings,
}: {
  editor: CanvasEditor
  containerRef: RefObject<HTMLDivElement | null>
  settings: DocSettings
}) {
  const { selection, dragging, editingText } = editor
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!selection || !container) {
      setPosition(null)
      return
    }
    const rect = rectInContainer(selection.item, container)
    setPosition({ top: Math.max(0, rect.top - 64), left: rect.left })
  }, [selection, containerRef, dragging])

  // Hidden mid-drag: a toolbar sliding along under the cursor is just noise.
  if (!selection || !position || dragging) return null

  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 rounded-md border border-white/10 bg-[#111219] px-1 py-0.5 shadow-lg"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {!editingText && (
        <MenuButton title="Editar el texto (o doble clic)" onClick={editor.beginTextEditing}>
          ✎ Texto
        </MenuButton>
      )}
      <MenuButton title="Traer al frente" onClick={editor.bringToFront}>
        ⬆
      </MenuButton>
      <MenuButton title="Enviar al fondo" onClick={editor.sendToBack}>
        ⬇
      </MenuButton>
      <div className="mx-0.5 h-4 w-px bg-white/10" />
      <MenuButton danger title="Eliminar este elemento" onClick={editor.remove}>
        🗑
      </MenuButton>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <CanvasStyleBar editor={editor} settings={settings} />
    </div>
  )
}
