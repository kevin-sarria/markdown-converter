import { useState } from 'react'
import type { DocFile } from '../lib/docFile'

interface FileTargetPickerProps {
  /** The files on offer — the caller decides which ones belong in the list. */
  docs: DocFile[]
  onPick: (targetIds: string[]) => void
  allLabel?: string
}

/**
 * "All of them / let me choose" over the loaded files, with the checkbox list.
 *
 * Renders the body of a menu, not its trigger, so each caller keeps its own
 * button and open state — copying style across files (ApplySettingsMenu) and
 * applying a cover template (TemplatePanel) need the same choice made in two
 * different places.
 */
export default function FileTargetPicker({ docs, onPick, allLabel = 'Todos los archivos' }: FileTargetPickerProps) {
  const [choosing, setChoosing] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (!choosing) {
    return (
      <>
        <button
          type="button"
          onClick={() => onPick(docs.map((d) => d.id))}
          className="block w-full px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          {allLabel}
        </button>
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="block w-full px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
        >
          Elegir archivos…
        </button>
      </>
    )
  }

  return (
    <div className="p-2">
      <div className="max-h-48 overflow-y-auto">
        {docs.map((d) => (
          <label
            key={d.id}
            className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm text-white/75 hover:bg-white/5"
          >
            <input
              type="checkbox"
              checked={selected.has(d.id)}
              onChange={() => toggle(d.id)}
              className="accent-indigo-400"
            />
            <span className="truncate">{d.name || 'documento'}</span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={selected.size === 0}
        onClick={() => {
          onPick([...selected])
          setSelected(new Set())
          setChoosing(false)
        }}
        className="mt-2 w-full rounded-md bg-indigo-500 px-2 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-400 disabled:opacity-40"
      >
        Aplicar{selected.size > 0 ? ` (${selected.size})` : ''}
      </button>
    </div>
  )
}
