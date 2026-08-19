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
  }
}

/** Same variables, serialized as a CSS string (for standalone HTML export). */
export function buildPreviewVarsCss(settings: DocSettings, options: PreviewVarsOptions = {}): string {
  const vars = buildPreviewVars(settings, options) as Record<string, string | number>
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
}
