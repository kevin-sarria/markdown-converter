import { useRef, useState } from 'react'
import { saveAs } from 'file-saver'
import FileTargetPicker from './FileTargetPicker'
import { hasCoverContent } from '../lib/coverPage'
import {
  parseTemplate,
  serializeTemplate,
  templateFileName,
  templateFromDoc,
  type DocTemplate,
} from '../lib/docTemplate'
import { deleteTemplate, listTemplates, saveTemplate } from '../lib/templateStore'
import type { DocFile } from '../lib/docFile'

interface TemplatePanelProps {
  docs: DocFile[]
  activeDoc: DocFile
  onApply: (template: DocTemplate, targetIds: string[]) => void
}

type Notice = { tone: 'ok' | 'error'; text: string } | null

/**
 * Saving the cover you built as a reusable template, and putting it on other
 * files.
 *
 * Two ways to keep one, because they fail differently: the browser library is
 * what you reach for day to day but disappears if the browser's data is
 * cleared, and an exported file survives anything but has to be found again.
 */
export default function TemplatePanel({ docs, activeDoc, onApply }: TemplatePanelProps) {
  // Read once, lazily, when the panel first mounts — the library only changes
  // through the buttons below, which refresh it themselves.
  const [templates, setTemplates] = useState<DocTemplate[]>(listTemplates)
  const [applying, setApplying] = useState<DocTemplate | null>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = () => setTemplates(listTemplates())
  const canSave = hasCoverContent(activeDoc.settings.coverPage)

  const keep = (template: DocTemplate) => {
    const result = saveTemplate(template)
    if (result.ok) {
      refresh()
      setNotice({ tone: 'ok', text: `Plantilla «${template.name}» guardada.` })
      return
    }
    setNotice({
      tone: 'error',
      text:
        result.reason === 'full'
          ? 'La biblioteca está llena. Borrá alguna plantilla, o exportá esta a un archivo.'
          : 'El navegador no deja guardar aquí. Podés exportar la plantilla a un archivo.',
    })
  }

  const handleSaveCurrent = () => {
    const name = window.prompt('Nombre de la plantilla:', activeDoc.name || 'portada')?.trim()
    if (!name) return
    if (templates.some((t) => t.name === name) && !window.confirm(`Ya existe «${name}». ¿La reemplazo?`)) return
    keep(templateFromDoc(activeDoc, name))
  }

  const handleExportCurrent = () => {
    const name = window.prompt('Nombre de la plantilla:', activeDoc.name || 'portada')?.trim()
    if (!name) return
    const template = templateFromDoc(activeDoc, name)
    saveAs(new Blob([serializeTemplate(template)], { type: 'application/json' }), templateFileName(template))
  }

  const handleImport = async (file: File | undefined) => {
    if (!file) return
    const template = parseTemplate(await file.text())
    if (!template) {
      setNotice({ tone: 'error', text: 'Ese archivo no es una plantilla de MD Studio.' })
      return
    }
    keep(template)
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Plantilla de portada</h3>

      <div className="flex flex-col gap-1.5">
        <button
          type="button"
          disabled={!canSave}
          title={canSave ? undefined : 'Primero armá una portada en este archivo'}
          onClick={handleSaveCurrent}
          className="w-full rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-40"
        >
          Guardar esta portada como plantilla…
        </button>

        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={!canSave}
            onClick={handleExportCurrent}
            className="flex-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white disabled:opacity-40"
          >
            Exportar
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex-1 rounded-md border border-white/10 px-2.5 py-1.5 text-xs font-medium text-white/70 transition hover:border-white/25 hover:text-white"
          >
            Importar
          </button>
        </div>
      </div>

      {notice && (
        <p className={`text-xs leading-relaxed ${notice.tone === 'ok' ? 'text-emerald-300/80' : 'text-amber-300/90'}`}>
          {notice.text}
        </p>
      )}

      {templates.length === 0 ? (
        <p className="text-xs leading-relaxed text-white/40">
          Todavía no guardaste ninguna. Las plantillas guardan la portada y el estilo, con los logos dentro, y se
          quedan en este navegador.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {templates.map((template) => (
            <li key={template.name} className="relative rounded-md border border-white/10">
              <div className="flex items-center gap-1 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-white/75" title={template.name}>
                  {template.name}
                </span>
                <button
                  type="button"
                  onClick={() => setApplying((current) => (current?.name === template.name ? null : template))}
                  className="rounded px-1.5 py-0.5 text-xs text-white/60 transition hover:bg-white/10 hover:text-white"
                >
                  Aplicar a…
                </button>
                <button
                  type="button"
                  title="Eliminar la plantilla"
                  onClick={() => {
                    if (!window.confirm(`¿Eliminar la plantilla «${template.name}»?`)) return
                    deleteTemplate(template.name)
                    if (applying?.name === template.name) setApplying(null)
                    refresh()
                  }}
                  className="rounded px-1.5 py-0.5 text-xs text-red-300/80 transition hover:bg-red-500/20"
                >
                  🗑
                </button>
              </div>

              {applying?.name === template.name && (
                <div className="overflow-hidden rounded-b-md border-t border-white/10 bg-[#15161c]">
                  <FileTargetPicker
                    docs={docs}
                    allLabel={`Todos los archivos (${docs.length})`}
                    onPick={(ids) => {
                      onApply(template, ids)
                      setApplying(null)
                    }}
                  />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          handleImport(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </section>
  )
}
