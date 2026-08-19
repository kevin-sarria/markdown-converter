export type HFAlign = 'left' | 'center' | 'right'

export interface HeaderFooterSettings {
  enabled: boolean
  logoDataUrl: string | null
  logoWidthMm: number
  headerText: string
  headerAlign: HFAlign
  footerText: string
  footerAlign: HFAlign
  showPageNumber: boolean
  pageNumberFormat: string
  showOnFirstPage: boolean
}

export interface WatermarkSettings {
  enabled: boolean
  type: 'text' | 'image'
  text: string
  imageDataUrl: string | null
  opacity: number
  rotationDeg: number
  fontSizePt: number
  color: string
}

export const DEFAULT_HEADER_FOOTER: HeaderFooterSettings = {
  enabled: false,
  logoDataUrl: null,
  logoWidthMm: 18,
  headerText: '',
  headerAlign: 'left',
  footerText: '',
  footerAlign: 'left',
  showPageNumber: true,
  pageNumberFormat: 'Página {page} de {pages}',
  showOnFirstPage: true,
}

export const DEFAULT_WATERMARK: WatermarkSettings = {
  enabled: false,
  type: 'text',
  text: 'CONFIDENCIAL',
  imageDataUrl: null,
  opacity: 0.15,
  rotationDeg: -45,
  fontSizePt: 60,
  color: '#8a8a8a',
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer el archivo'))
    reader.readAsDataURL(file)
  })
}

export function formatPageNumber(format: string, page: number, pages: number): string {
  return format.replace(/\{page\}/g, String(page)).replace(/\{pages\}/g, String(pages))
}
