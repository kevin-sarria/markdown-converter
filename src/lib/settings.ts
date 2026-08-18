import { COLOR_THEMES, FONT_PAIRINGS, type Margin, type PageSize } from './themes'

export interface DocSettings {
  themeId: string
  fontId: string
  fontSizePt: number
  lineHeight: number
  pageSize: PageSize
  margin: Margin
}

export const DEFAULT_SETTINGS: DocSettings = {
  themeId: COLOR_THEMES[0].id,
  fontId: FONT_PAIRINGS[0].id,
  fontSizePt: 12,
  lineHeight: 1.6,
  pageSize: 'a4',
  margin: 'normal',
}

export function getTheme(id: string) {
  return COLOR_THEMES.find((t) => t.id === id) ?? COLOR_THEMES[0]
}

export function getFontPairing(id: string) {
  return FONT_PAIRINGS.find((f) => f.id === id) ?? FONT_PAIRINGS[0]
}
