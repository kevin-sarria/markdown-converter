import type { CSSProperties } from 'react'
import { getFontPairing, getTheme, type DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

export interface PreviewVarsOptions {
  /**
   * Zeroes the vertical (top/bottom) padding — used only for the node handed to
   * html2pdf for PDF export, where the vertical margin instead comes from
   * html2pdf's own `margin` option so it repeats on every sliced page. See
   * exportPdf.ts for the full explanation.
   */
  pdfMode?: boolean
}

/** Builds the CSS custom properties that drive .md-preview, as an inline style object. */
export function buildPreviewVars(settings: DocSettings, options: PreviewVarsOptions = {}): CSSProperties {
  const theme = getTheme(settings.themeId)
  const font = getFontPairing(settings.fontId)
  const page = PAGE_SIZES[settings.pageSize]
  const margin = MARGINS[settings.margin]

  return {
    ['--p-bg' as string]: theme.bg,
    ['--p-text' as string]: theme.text,
    ['--p-muted' as string]: theme.muted,
    ['--p-heading' as string]: theme.heading,
    ['--p-accent' as string]: theme.accent,
    ['--p-border' as string]: theme.border,
    ['--p-code-bg' as string]: theme.codeBg,
    ['--p-code-text' as string]: theme.codeText,
    ['--p-table-head-bg' as string]: theme.tableHeadBg,
    ['--p-blockquote-bg' as string]: theme.blockquoteBg,
    ['--p-font-heading' as string]: font.heading,
    ['--p-font-body' as string]: font.body,
    ['--p-font-mono' as string]: font.mono,
    ['--p-font-size' as string]: `${settings.fontSizePt}pt`,
    ['--p-line-height' as string]: settings.lineHeight,
    ['--p-margin-x' as string]: `${margin.mm}mm`,
    ['--p-margin-y' as string]: options.pdfMode ? '0mm' : `${margin.mm}mm`,
    ['--p-width' as string]: `${page.widthMm}mm`,
    ['--p-height' as string]: `${page.heightMm}mm`,
    // A canvas page (::: lienzo) is exactly one printed page of content, so it
    // needs the real margin subtracted — not --p-margin-y, which pdfMode zeroes
    // because html2pdf carves the vertical band itself. Deriving the canvas
    // height from that zero would make every canvas two margins too tall and
    // spill each one onto a second PDF page.
    //
    // The extra 2mm are the same shave the cover page takes (see exportPdf.ts):
    // filling the page band *exactly* leaves the following break sitting on the
    // page boundary, which html2pdf's pagebreak plugin reads as a break that has
    // already happened and pads a blank page for. Coming in just under keeps a
    // canvas to the single page it is, with no visible difference.
    ['--p-canvas-height' as string]: `${page.heightMm - margin.mm * 2 - 2}mm`,
  }
}

/** Same variables, serialized as a CSS string (for standalone HTML export). */
export function buildPreviewVarsCss(settings: DocSettings, options: PreviewVarsOptions = {}): string {
  const vars = buildPreviewVars(settings, options) as Record<string, string | number>
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
}
