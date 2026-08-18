import html2pdf from 'html2pdf.js'
import type { DocSettings } from './settings'

export async function exportToPdf(
  node: HTMLElement,
  settings: DocSettings,
  fileName: string,
): Promise<void> {
  const opt = {
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

  await html2pdf().set(opt).from(node).save()
}
