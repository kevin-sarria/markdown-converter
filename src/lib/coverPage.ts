export interface CoverPageSettings {
  enabled: boolean
  /** Free-form Markdown — edited with the same WYSIWYG surface as the document body, see PreviewPane.tsx. */
  content: string
}

export const DEFAULT_COVER_PAGE: CoverPageSettings = {
  enabled: false,
  content: '',
}

/** Whether the cover page has anything worth rendering as a leading page in an export. */
export function hasCoverContent(cover: CoverPageSettings): boolean {
  return cover.enabled && cover.content.trim() !== ''
}
