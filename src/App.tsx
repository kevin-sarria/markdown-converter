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
  return [{ id: makeDocId(), name: 'mi-documento', markdown: SAMPLE_MARKDOWN, settings: DEFAULT_SETTINGS }]
}

type MobileView = 'editor' | 'preview' | 'settings'

export default function App() {
  const [docs, setDocs] = useState<DocFile[]>(initialDocs)
  const [activeId, setActiveId] = useState(docs[0].id)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const [mobileView, setMobileView] = useState<MobileView>('editor')
  const [fileDrawerOpen, setFileDrawerOpen] = useState(false)
  const previewRef = useRef<HTMLDivElement>(null)

  const activeDoc = docs.find((d) => d.id === activeId) ?? docs[0]

  const updateActiveDoc = (patch: Partial<DocFile>) => {
    setDocs((prev) => prev.map((d) => (d.id === activeId ? { ...d, ...patch } : d)))
  }

  // Style/header/footer/watermark/cover live per file — editing always targets
  // just the active document by default. See ApplySettingsMenu for copying the
  // active document's settings onto other loaded files on purpose.
  const patchSettings = (patch: Partial<DocSettings>) =>
    updateActiveDoc({ settings: { ...activeDoc.settings, ...patch } })

  const handleApplySettings = (targetIds: string[]) => {
    const targetSet = new Set(targetIds)
    setDocs((prev) => prev.map((d) => (targetSet.has(d.id) ? { ...d, settings: activeDoc.settings } : d)))
  }

  const handleUploadFiles = async (files: FileList) => {
    const list = Array.from(files).filter((f) => /\.(md|markdown|txt)$/i.test(f.name) || f.type === 'text/markdown')
    if (list.length === 0) return

    const newDocs = await Promise.all(
      list.map(async (file) => {
        const text = await file.text()
        const base = file.name.replace(/\.(md|markdown|txt)$/i, '')
        return { id: makeDocId(), name: slugify(base), markdown: text, settings: DEFAULT_SETTINGS }
      }),
    )

    setDocs((prev) => [...prev, ...newDocs])
    setActiveId(newDocs[0].id)
  }

  const handleSelectDoc = (id: string) => {
    setActiveId(id)
    setFileDrawerOpen(false)
  }

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
    await exportToPdf(previewRef.current, activeDoc.settings, slugify(activeDoc.name))
  }

  const handleExportDocx = async () => {
    const { exportToDocx } = await import('./lib/exportDocx')
    await exportToDocx(activeDoc.markdown, activeDoc.settings, slugify(activeDoc.name))
  }

  const handleExportHtml = () => {
    exportToHtml(activeDoc.markdown, activeDoc.settings, slugify(activeDoc.name))
  }

  const handleDownloadAll = async (format: BatchFormat) => {
    await downloadAllAsZip(
      docs.map((d) => ({ name: slugify(d.name), markdown: d.markdown, settings: d.settings })),
      format,
    )
  }

  const mobileTabs: { key: MobileView; label: string }[] = [
    { key: 'editor', label: 'Markdown' },
    { key: 'preview', label: 'Vista previa' },
    { key: 'settings', label: 'Estilo' },
  ]

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
        onToggleFileDrawer={() => setFileDrawerOpen((v) => !v)}
      />

      <div className="flex border-b border-white/5 bg-[#0b0c10] px-2 py-1.5 lg:hidden">
        {mobileTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setMobileView(t.key)
              if (t.key === 'settings') setSettingsOpen(true)
            }}
            className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
              mobileView === t.key ? 'bg-indigo-400/20 text-white' : 'text-white/50 hover:text-white/80'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col lg:flex-row">
        {fileDrawerOpen && (
          <div className="fixed inset-0 z-40 flex lg:hidden">
            <div className="absolute inset-0 bg-black/60" onClick={() => setFileDrawerOpen(false)} />
            <div className="relative z-10 h-full">
              <FileList docs={docs} activeId={activeDoc.id} onSelect={handleSelectDoc} onRemove={handleRemoveDoc} />
            </div>
          </div>
        )}
        <div className="hidden lg:flex">
          <FileList docs={docs} activeId={activeDoc.id} onSelect={handleSelectDoc} onRemove={handleRemoveDoc} />
        </div>

        <div
          className={`min-h-0 min-w-0 w-full border-r border-white/5 lg:w-[34%] lg:min-w-[300px] ${
            mobileView === 'editor' ? 'flex flex-1' : 'hidden'
          } lg:flex`}
        >
          <Editor value={activeDoc.markdown} onChange={(markdown) => updateActiveDoc({ markdown })} />
        </div>
        <div
          className={`min-h-0 min-w-0 overflow-auto bg-[#1a1b22] ${
            mobileView === 'preview' ? 'flex flex-1' : 'hidden'
          } lg:flex lg:flex-1`}
        >
          <PreviewPane
            ref={previewRef}
            markdown={activeDoc.markdown}
            settings={activeDoc.settings}
            onMarkdownChange={(markdown) => updateActiveDoc({ markdown })}
            onCoverContentChange={(content) => patchSettings({ coverPage: { ...activeDoc.settings.coverPage, content } })}
          />
        </div>
        {settingsOpen && (
          <div className={`min-h-0 min-w-0 w-full lg:w-auto ${mobileView === 'settings' ? 'flex flex-1' : 'hidden'} lg:flex`}>
            <SettingsPanel
              settings={activeDoc.settings}
              onChange={patchSettings}
              docs={docs}
              activeDocId={activeDoc.id}
              onApplySettings={handleApplySettings}
            />
          </div>
        )}
      </div>
    </div>
  )
}
