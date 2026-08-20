import { useLayoutEffect, useState, type ReactNode, type RefObject } from 'react'
import { COLUMN_ALIGNS, type ColumnAlign } from '../lib/columns'
import { columnsOfRow } from '../lib/columnsDom'
import { rectInContainer } from '../lib/overlayPosition'
import type { ColumnsRowController } from '../hooks/useColumnsRow'

const ALIGN_LABEL: Record<ColumnAlign, string> = {
  arriba: '⤒',
  centro: '⇅',
  abajo: '⤓',
}

const ALIGN_TITLE: Record<ColumnAlign, string> = {
  arriba: 'Alinear arriba',
  centro: 'Alinear al centro',
  abajo: 'Alinear abajo',
}

function MenuButton({
  onClick,
  title,
  disabled,
  danger,
  children,
}: {
  onClick: () => void
  title: string
  disabled?: boolean
  danger?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1.5 text-xs font-medium disabled:opacity-30 ${
        danger ? 'text-red-300 hover:bg-red-500/20' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * The floating toolbar for the selected columns row. Sits above the row, in the
 * preview container's coordinate space (see overlayPosition.ts) rather than
 * inside the page, so it never becomes part of the exported document.
 *
 * "Deshacer columnas" and "Eliminar" are deliberately two separate buttons.
 * They are one click apart and one of them destroys everything in the row; a
 * single ambiguous "remove" button would eventually take content the user meant
 * to keep, and this editor has no undo of its own to walk that back.
 */
export default function ColumnsRowMenu({
  controller,
  containerRef,
}: {
  controller: ColumnsRowController
  containerRef: RefObject<HTMLDivElement | null>
}) {
  const { selection } = controller
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!selection || !container) {
      setPosition(null)
      return
    }
    const rect = rectInContainer(selection.row, container)
    setPosition({ top: Math.max(0, rect.top - 34), left: rect.left })
  }, [selection, containerRef])

  if (!selection || !position) return null

  const columnCount = columnsOfRow(selection.row).length
  const align = (selection.row.getAttribute('data-align') ?? 'arriba') as ColumnAlign

  return (
    <div
      className="absolute z-30 flex items-center gap-0.5 rounded-md border border-white/10 bg-[#111219] px-1 py-0.5 shadow-lg"
      style={{ top: position.top, left: position.left }}
      // Without this the click blurs the editable region first, and the
      // selection the action needs is already gone by the time it runs.
      onMouseDown={(e) => e.preventDefault()}
    >
      <span className="px-1 text-[10px] text-white/40">{columnCount} col.</span>

      <MenuButton title="Añadir columna" onClick={controller.addColumn}>
        ＋
      </MenuButton>
      <MenuButton title="Quitar la última columna" disabled={columnCount <= 1} onClick={controller.removeLastColumn}>
        －
      </MenuButton>
      <MenuButton title="Igualar los anchos" onClick={controller.equalize}>
        ⇤⇥
      </MenuButton>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      {COLUMN_ALIGNS.map((option) => (
        <MenuButton
          key={option}
          title={ALIGN_TITLE[option]}
          onClick={() => controller.setAlign(option)}
        >
          <span className={align === option ? 'text-white' : undefined}>{ALIGN_LABEL[option]}</span>
        </MenuButton>
      ))}

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <MenuButton title="Deshacer las columnas, conservando el contenido" onClick={controller.unwrap}>
        ⇱
      </MenuButton>
      <MenuButton danger title="Eliminar la fila y todo su contenido" onClick={controller.remove}>
        🗑
      </MenuButton>
    </div>
  )
}
