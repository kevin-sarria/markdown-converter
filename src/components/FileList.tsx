import type { DocFile } from '../lib/docFile'

interface FileListProps {
  docs: DocFile[]
  activeId: string
  onSelect: (id: string) => void
  onRemove: (id: string) => void
}

export default function FileList({ docs, activeId, onSelect, onRemove }: FileListProps) {
  return (
    <div className="flex h-full w-56 shrink-0 flex-col border-r border-white/5 bg-[#0f1015]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-2">
        <span className="text-xs font-medium uppercase tracking-wide text-white/40">
          Archivos
        </span>
        <span className="text-xs text-white/30">{docs.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto p-1.5">
        {docs.map((doc) => {
          const active = doc.id === activeId
          return (
            <div
              key={doc.id}
              className={`group mb-1 flex items-center gap-1 rounded-md border px-2 py-1.5 transition ${
                active
                  ? 'border-indigo-400/70 bg-indigo-400/10'
                  : 'border-transparent hover:border-white/10 hover:bg-white/5'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelect(doc.id)}
                className={`min-w-0 flex-1 truncate text-left text-sm ${
                  active ? 'text-white' : 'text-white/70'
                }`}
                title={doc.name}
              >
                {doc.name || 'documento'}
              </button>
              {docs.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemove(doc.id)}
                  className="shrink-0 rounded px-1 text-xs text-white/25 opacity-0 transition hover:text-white/70 group-hover:opacity-100"
                  aria-label={`Quitar ${doc.name}`}
                  title="Quitar"
                >
                  ✕
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
