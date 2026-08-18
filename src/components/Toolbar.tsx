import { useRef, useState, type ChangeEvent } from 'react'

interface ToolbarProps {
  fileName: string
  onFileNameChange: (name: string) => void
  onUploadFile: (file: File) => void
  onExportPdf: () => Promise<void>
  onExportDocx: () => Promise<void>
  onExportHtml: () => void
  onReset: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
}

export default function Toolbar({
  fileName,
  onFileNameChange,
  onUploadFile,
  onExportPdf,
  onExportDocx,
  onExportHtml,
  onReset,
  settingsOpen,
  onToggleSettings,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null)

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) onUploadFile(file)
    e.target.value = ''
  }

  const runExport = async (kind: 'pdf' | 'docx') => {
    setBusy(kind)
    try {
      if (kind === 'pdf') await onExportPdf()
      else await onExportDocx()
    } finally {
      setBusy(null)
    }
  }

  return (
    <header className="flex items-center gap-3 border-b border-white/5 bg-[#0b0c10] px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-400 to-fuchsia-500 text-sm font-bold text-white">
          M
        </div>
        <span className="text-sm font-semibold text-white/90">MD Studio</span>
      </div>

      <input
        value={fileName}
        onChange={(e) => onFileNameChange(e.target.value)}
        className="ml-2 w-48 rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-400/60"
        placeholder="nombre-del-documento"
      />

      <div className="ml-auto flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".md,.markdown,text/markdown" className="hidden" onChange={handleFileChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
        >
          Subir .md
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/50 transition hover:border-white/25 hover:text-white"
        >
          Limpiar
        </button>

        <div className="mx-1 h-6 w-px bg-white/10" />

        <button
          type="button"
          onClick={onExportHtml}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white"
        >
          HTML
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runExport('docx')}
          className="rounded-md border border-white/10 px-3 py-1.5 text-sm text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-50"
        >
          {busy === 'docx' ? 'Generando…' : 'Word (.docx)'}
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => runExport('pdf')}
          className="rounded-md bg-indigo-500 px-3.5 py-1.5 text-sm font-medium text-white shadow shadow-indigo-500/30 transition hover:bg-indigo-400 disabled:opacity-50"
        >
          {busy === 'pdf' ? 'Generando…' : 'Exportar PDF'}
        </button>

        <div className="mx-1 h-6 w-px bg-white/10" />

        <button
          type="button"
          onClick={onToggleSettings}
          aria-pressed={settingsOpen}
          className={`rounded-md border px-3 py-1.5 text-sm transition ${
            settingsOpen
              ? 'border-indigo-400/70 bg-indigo-400/10 text-white'
              : 'border-white/10 text-white/70 hover:border-white/25 hover:text-white'
          }`}
        >
          Estilo
        </button>
      </div>
    </header>
  )
}
