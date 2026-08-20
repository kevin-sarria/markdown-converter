import type { DocSettings } from './settings'

export interface DocFile {
  id: string
  name: string
  markdown: string
  /** Style/header/footer/watermark/cover — independent per file, see ApplySettingsMenu.tsx to copy across files. */
  settings: DocSettings
}

export function slugify(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned || 'documento'
}

export function makeDocId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
