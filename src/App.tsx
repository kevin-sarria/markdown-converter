import { useRef, useState } from 'react'
import Editor from './components/Editor'
import FileList from './components/FileList'
import PreviewPane from './components/PreviewPane'
import SettingsPanel from './components/SettingsPanel'
import Toolbar from './components/Toolbar'
import { makeDocId, slugify, type DocFile } from './lib/docFile'
import { downloadAllAsZip, type BatchFormat } from './lib/exportBatch'
import { exportToHtml } from './lib/exportHtml'
import { SAMPLE_MARKDOWN } from './lib/markdown'
import { DEFAULT_SETTINGS, type DocSettings } from './lib/settings'

function initialDocs(): DocFile[] {
  return [{ id: makeDocId(), name: 'mi-documento', markdown: SAMPLE_MARKDOWN }]
}

export default function App() {
  const [docs, setDocs] = useState<DocFile[]>(initialDocs)
  const [activeId, setActiveId] = useState(docs[0].id)
  const [settings, setSettings] = useState<DocSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const previewRef = useRef<HTMLDivElement>(null)

  const activeDoc = docs.find((d) => d.id === activeId) ?? docs[0]

  const patchSettings = (patch: Partial<DocSettings>) => setSettings((prev) => ({ ...prev, ...patch }))

  const updateActiveDoc = (patch: Partial<DocFile>) => {
    setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, ...patch } : d)))
  }

  const handleUploadFiles = async (files: FileList) => {
    const list = Array.from(files).filter((f) => /\.(md|markdown|txt)$/i.test(f.name) || f.type === 'text/markdown')
    if (list.length === 0) return

    const newDocs = await Promise.all(
      list.map(async (file) => {
        const text = await file.text()
        const base = file.name.replace(/\.(md|markdown|txt)$/i, '')
        return { id: makeDocId(), name: slugify(base), markdown: text }
      }),
    )

    setDocs((prev) => [...prev, ...newDocs])
    setActiveId(newDocs[0].id)
  }

  const handleSelectDoc = (id: string) => setActiveId(id)

  const handleRemoveDoc = (id: string) => {
    setDocs((prev) => {
      const next = prev.filter((d) => d.id !== id)
      const safeNext = next.length > 0 ? next : initialDocs()
      if (id === activeId) setActiveId(safeNext[0].id)
      return safeNext
    })
  }

  const handleReset = () => {
    updateActiveDoc({ markdown: '', name: 'documento' })
  }

  const handleExportPdf = async () => {
    if (!previewRef.current) return
    const { exportToPdf } = await import('./lib/exportPdf')
    await exportToPdf(previewRef.current, settings, slugify(activeDoc.name))
  }

  const handleExportDocx = async () => {
    const { exportToDocx } = await import('./lib/exportDocx')
    await exportToDocx(activeDoc.markdown, settings, slugify(activeDoc.name))
  }

  const handleExportHtml = () => {
    exportToHtml(activeDoc.markdown, settings, slugify(activeDoc.name))
  }

  const handleDownloadAll = async (format: BatchFormat) => {
    await downloadAllAsZip(
      docs.map((d) => ({ name: slugify(d.name), markdown: d.markdown })),
      settings,
      format,
    )
  }

  return (
    <div className="flex h-screen flex-col bg-[#0b0c10]">
      <Toolbar
        fileName={activeDoc.name}
        onFileNameChange={(name) => updateActiveDoc({ name })}
        onUploadFiles={handleUploadFiles}
        onExportPdf={handleExportPdf}
        onExportDocx={handleExportDocx}
        onExportHtml={handleExportHtml}
        onReset={handleReset}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
        fileCount={docs.length}
        onDownloadAll={handleDownloadAll}
      />
      <div className="flex min-h-0 flex-1">
        <FileList docs={docs} activeId={activeDoc.id} onSelect={handleSelectDoc} onRemove={handleRemoveDoc} />
        <div className="w-[34%] min-w-[300px] border-r border-white/5">
          <Editor value={activeDoc.markdown} onChange={(markdown) => updateActiveDoc({ markdown })} />
        </div>
        <div className="flex-1 overflow-auto bg-[#1a1b22]">
          <PreviewPane ref={previewRef} markdown={activeDoc.markdown} settings={settings} />
        </div>
        {settingsOpen && <SettingsPanel settings={settings} onChange={patchSettings} />}
      </div>
    </div>
  )
}
