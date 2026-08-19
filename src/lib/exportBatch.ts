import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { buildHtmlBlob } from './exportHtml'
import type { DocSettings } from './settings'

export type BatchFormat = 'pdf' | 'docx' | 'html'

export interface BatchDoc {
  name: string
  markdown: string
}

const EXTENSION: Record<BatchFormat, string> = { pdf: 'pdf', docx: 'docx', html: 'html' }

// docx/html2pdf.js are heavy — keep them out of the main bundle, same as the
// single-file export handlers in App.tsx, by importing only the format in use.
async function buildBlob(format: BatchFormat, doc: BatchDoc, settings: DocSettings): Promise<Blob> {
  switch (format) {
    case 'pdf': {
      const { buildPdfBlob } = await import('./exportPdf')
      return buildPdfBlob(doc.markdown, settings, doc.name)
    }
    case 'docx': {
      const { buildDocxBlob } = await import('./exportDocx')
      return buildDocxBlob(doc.markdown, settings)
    }
    case 'html':
      return buildHtmlBlob(doc.markdown, settings, doc.name)
  }
}

/** Appends a numeric suffix (doc, doc-2, doc-3, ...) so duplicate names don't collide in the zip. */
function uniqueName(name: string, used: Map<string, number>): string {
  const count = used.get(name) ?? 0
  used.set(name, count + 1)
  return count === 0 ? name : `${name}-${count + 1}`
}

export async function downloadAllAsZip(
  docs: BatchDoc[],
  settings: DocSettings,
  format: BatchFormat,
): Promise<void> {
  const zip = new JSZip()
  const used = new Map<string, number>()

  // PDF rendering shares one hidden DOM node internally in html2canvas, so run
  // conversions sequentially rather than with Promise.all to avoid races.
  for (const doc of docs) {
    const blob = await buildBlob(format, doc, settings)
    const name = uniqueName(doc.name || 'documento', used)
    zip.file(`${name}.${EXTENSION[format]}`, blob)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  saveAs(zipBlob, `documentos-${format}.zip`)
}
