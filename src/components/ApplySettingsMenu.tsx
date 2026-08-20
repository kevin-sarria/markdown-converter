import { useEffect, useRef, useState } from 'react'
import FileTargetPicker from './FileTargetPicker'
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
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClickAway = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [open])

  // Copying a document's settings onto itself is a no-op, so it isn't offered.
  const others = docs.filter((d) => d.id !== activeDocId)
  if (others.length === 0) return null

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
          open
            ? 'border-indigo-400/70 bg-indigo-400/10 text-white'
            : 'border-white/10 text-white/70 hover:border-white/25 hover:text-white'
        }`}
      >
        Aplicar estilo a otros archivos…
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-20 w-60 overflow-hidden rounded-md border border-white/10 bg-[#15161c] shadow-lg shadow-black/40">
          <FileTargetPicker
            docs={others}
            onPick={(ids) => {
              onApply(ids)
              setOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}
