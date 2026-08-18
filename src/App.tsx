import { useRef, useState } from 'react'
import Editor from './components/Editor'
import PreviewPane from './components/PreviewPane'
import SettingsPanel from './components/SettingsPanel'
import Toolbar from './components/Toolbar'
import { exportToHtml } from './lib/exportHtml'
import { SAMPLE_MARKDOWN } from './lib/markdown'
import { DEFAULT_SETTINGS, type DocSettings } from './lib/settings'

function slugify(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'documento'
}

export default function App() {
  const [markdown, setMarkdown] = useState(SAMPLE_MARKDOWN)
  const [fileName, setFileName] = useState('mi-documento')
  const [settings, setSettings] = useState<DocSettings>(DEFAULT_SETTINGS)
  const [settingsOpen, setSettingsOpen] = useState(true)
  const previewRef = useRef<HTMLDivElement>(null)

  const patchSettings = (patch: Partial<DocSettings>) => setSettings((prev) => ({ ...prev, ...patch }))

  const handleUploadFile = async (file: File) => {
    const text = await file.text()
    setMarkdown(text)
    const base = file.name.replace(/\.(md|markdown|txt)$/i, '')
    setFileName(slugify(base))
  }

  const handleReset = () => {
    setMarkdown('')
    setFileName('documento')
  }

  const handleExportPdf = async () => {
    if (!previewRef.current) return
    const { exportToPdf } = await import('./lib/exportPdf')
    await exportToPdf(previewRef.current, settings, slugify(fileName))
  }

  const handleExportDocx = async () => {
    const { exportToDocx } = await import('./lib/exportDocx')
    await exportToDocx(markdown, settings, slugify(fileName))
  }

  const handleExportHtml = () => {
    exportToHtml(markdown, settings, slugify(fileName))
  }

  return (
    <div className="flex h-screen flex-col bg-[#0b0c10]">
      <Toolbar
        fileName={fileName}
        onFileNameChange={setFileName}
        onUploadFile={handleUploadFile}
        onExportPdf={handleExportPdf}
        onExportDocx={handleExportDocx}
        onExportHtml={handleExportHtml}
        onReset={handleReset}
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((v) => !v)}
      />
      <div className="flex min-h-0 flex-1">
        <div className="w-[38%] min-w-[320px] border-r border-white/5">
          <Editor value={markdown} onChange={setMarkdown} />
        </div>
        <div className="flex-1 overflow-auto bg-[#1a1b22]">
          <PreviewPane ref={previewRef} markdown={markdown} settings={settings} />
        </div>
        {settingsOpen && <SettingsPanel settings={settings} onChange={patchSettings} />}
      </div>
    </div>
  )
}
