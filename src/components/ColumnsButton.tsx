import { useEffect, useRef, useState } from 'react'

const CHOICES = [2, 3, 4] as const

/**
 * "Columnas" in the editor toolbar, with a small picker for how many.
 *
 * The picker keeps mousedown from reaching the document (like the rest of the
 * toolbar) so opening it doesn't blur the editable region and throw away the
 * caret the row is about to be inserted at.
 */
export default function ColumnsButton({ onInsert }: { onInsert: (count: number) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        title="Insertar una fila de columnas"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
      >
        ▤ Columnas
      </button>

      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 flex gap-1 rounded-md border border-white/10 bg-[#111219] p-1 shadow-lg">
          {CHOICES.map((count) => (
            <button
              key={count}
              type="button"
              title={`${count} columnas`}
              onClick={() => {
                setOpen(false)
                onInsert(count)
              }}
              className="flex h-7 w-9 items-center justify-center gap-px rounded border border-white/10 text-[10px] text-white/70 hover:border-white/30 hover:text-white"
            >
              {Array.from({ length: count }, (_, i) => (
                <span key={i} className="h-4 w-1.5 rounded-[1px] bg-current opacity-60" />
              ))}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
