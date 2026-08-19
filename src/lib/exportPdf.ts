import html2pdf from 'html2pdf.js'
import { renderMarkdownToHtml } from './markdown'
import { buildPreviewVarsCss } from './previewStyle'
import type { DocSettings } from './settings'

function pdfOptions(settings: DocSettings, fileName: string) {
  return {
    margin: 0,
    filename: `${fileName}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      backgroundColor: null,
    },
    jsPDF: {
      unit: 'mm',
      format: settings.pageSize,
      orientation: 'portrait',
    },
    pagebreak: { mode: ['css', 'avoid-all'] },
  } as const
}

export async function exportToPdf(
  node: HTMLElement,
  settings: DocSettings,
  fileName: string,
): Promise<void> {
  await html2pdf().set(pdfOptions(settings, fileName)).from(node).save()
}

/**
 * Renders markdown off-screen (reusing the same .md-preview styling as the live
 * preview, via the globally-loaded preview.css) and returns the resulting PDF as
 * a blob, without touching the visible DOM. Used for batch export of files that
 * aren't the currently active/previewed document.
 */
export async function buildPdfBlob(
  markdown: string,
  settings: DocSettings,
  fileName: string,
): Promise<Blob> {
  const node = document.createElement('div')
  node.className = 'md-preview page-shell'
  node.setAttribute('style', buildPreviewVarsCss(settings))
  node.innerHTML = renderMarkdownToHtml(markdown)
  node.style.position = 'fixed'
  node.style.left = '-10000px'
  node.style.top = '0'
  document.body.appendChild(node)

  try {
    const blob: Blob = await html2pdf().set(pdfOptions(settings, fileName)).from(node).outputPdf('blob')
    return blob
  } finally {
    document.body.removeChild(node)
  }
}
