import { useEffect, useRef, useState } from 'react'
import type { DocFile } from '../lib/docFile'

interface ApplySettingsMenuProps {
  docs: DocFile[]
  activeDocId: string
  onApply: (targetIds: string[]) => void
}

/**
 * Copies the active document's style/header/footer/watermark/cover onto other
 * loaded files, on demand — a one-time copy, not a live link, so it's always
 * clear which files have which settings (see App.tsx's per-file `settings`).
 */
export default function ApplySettingsMenu({ docs, activeDocId, onApply }: ApplySettingsMenuProps) {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
        setChoosing(false)
      }
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  const others = docs.filter((d) => d.id !== activeDocId)
  if (others.length === 0) return null

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleApplyAll = () => {
    onApply(others.map((d) => d.id))
    setOpen(false)
  }

  const handleApplyChosen = () => {
    onApply([...selected])
    setSelected(new Set())
    setChoosing(false)
    setOpen(false)
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
          open ? 'border-indigo-400/70 bg-indigo-400/10 text-white' : 'border-white/10 text-white/70 hover:border-white/25 hover:text-white'
        }`}
      >
        Aplicar estilo a otros archivos…
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-60 overflow-hidden rounded-md border border-white/10 bg-[#15161c] shadow-lg shadow-black/40">
          {!choosing ? (
            <>
              <button
                type="button"
                onClick={handleApplyAll}
                className="block w-full px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Todos los archivos
              </button>
              <button
                type="button"
                onClick={() => setChoosing(true)}
                className="block w-full px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
              >
                Elegir archivos…
              </button>
            </>
          ) : (
            <div className="p-2">
              <div className="max-h-48 overflow-y-auto">
                {others.map((d) => (
                  <label key={d.id} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-white/75 hover:bg-white/5">
                    <input
                      type="checkbox"
                      checked={selected.has(d.id)}
                      onChange={() => toggleSelected(d.id)}
                      className="accent-indigo-400"
                    />
                    <span className="truncate">{d.name || 'documento'}</span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={selected.size === 0}
                onClick={handleApplyChosen}
                className="mt-2 w-full rounded-md bg-indigo-500 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-40"
              >
                Aplicar{selected.size > 0 ? ` (${selected.size})` : ''}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
