import type { LogoItem } from './logos'

export interface CoverPageSettings {
  enabled: boolean
  title: string
  subtitle: string
  logos: LogoItem[]
}

export const DEFAULT_COVER_PAGE: CoverPageSettings = {
  enabled: false,
  title: '',
  subtitle: '',
  logos: [],
}

/** Whether the cover page has anything worth rendering as a leading page. */
export function hasCoverContent(cover: CoverPageSettings): boolean {
  return cover.enabled && (cover.title.trim() !== '' || cover.subtitle.trim() !== '' || cover.logos.length > 0)
}
