import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import type { BatchFormat } from '../lib/exportBatch'

interface ToolbarProps {
  fileName: string
  onFileNameChange: (name: string) => void
  onUploadFiles: (files: FileList) => void
  onExportPdf: () => Promise<void>
  onExportDocx: () => Promise<void>
  onExportHtml: () => void
  onReset: () => void
  settingsOpen: boolean
  onToggleSettings: () => void
  fileCount: number
  onDownloadAll: (format: BatchFormat) => Promise<void>
}

export default function Toolbar({
  fileName,
  onFileNameChange,
  onUploadFiles,
  onExportPdf,
  onExportDocx,
  onExportHtml,
  onReset,
  settingsOpen,
  onToggleSettings,
  fileCount,
  onDownloadAll,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<'pdf' | 'docx' | null>(null)
  const [batchBusy, setBatchBusy] = useState<BatchFormat | null>(null)
  const [batchMenuOpen, setBatchMenuOpen] = useState(false)
  const batchMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!batchMenuOpen) return
    const onClickAway = (e: MouseEvent) => {
      if (batchMenuRef.current && !batchMenuRef.current.contains(e.target as Node)) {
        setBatchMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickAway)
    return () => document.removeEventListener('mousedown', onClickAway)
  }, [batchMenuOpen])

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) onUploadFiles(files)
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

  const runBatch = async (format: BatchFormat) => {
    setBatchMenuOpen(false)
    setBatchBusy(format)
    try {
      await onDownloadAll(format)
    } finally {
      setBatchBusy(null)
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
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".md,.markdown,text/markdown"
          className="hidden"
          onChange={handleFileChange}
        />
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

        {fileCount > 1 && (
          <>
            <div className="mx-1 h-6 w-px bg-white/10" />
            <div className="relative" ref={batchMenuRef}>
              <button
                type="button"
                disabled={batchBusy !== null}
                onClick={() => setBatchMenuOpen((v) => !v)}
                className="rounded-md border border-fuchsia-400/50 bg-fuchsia-400/10 px-3.5 py-1.5 text-sm font-medium text-white transition hover:border-fuchsia-400/80 disabled:opacity-50"
              >
                {batchBusy ? 'Convirtiendo…' : `Descargar todos (${fileCount})`}
              </button>
              {batchMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-10 w-40 overflow-hidden rounded-md border border-white/10 bg-[#15161c] shadow-lg shadow-black/40">
                  {(['pdf', 'docx', 'html'] as BatchFormat[]).map((format) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => runBatch(format)}
                      className="block w-full px-3 py-2 text-left text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
                    >
                      {format === 'pdf' ? 'Todos a PDF (.zip)' : format === 'docx' ? 'Todos a Word (.zip)' : 'Todos a HTML (.zip)'}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

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
