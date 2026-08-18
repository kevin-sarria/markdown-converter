import type { CSSProperties } from 'react'
import { getFontPairing, getTheme, type DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

/** Builds the CSS custom properties that drive .md-preview, as an inline style object. */
export function buildPreviewVars(settings: DocSettings): CSSProperties {
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
    ['--p-margin' as string]: `${margin.mm}mm`,
    ['--p-width' as string]: `${page.widthMm}mm`,
    ['--p-height' as string]: `${page.heightMm}mm`,
  }
}

/** Same variables, serialized as a CSS string (for standalone HTML export). */
export function buildPreviewVarsCss(settings: DocSettings): string {
  const vars = buildPreviewVars(settings) as Record<string, string | number>
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ')
}
