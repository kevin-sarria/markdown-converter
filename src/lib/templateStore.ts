import { parseTemplate, type DocTemplate } from './docTemplate'

export const STORAGE_KEY = 'md-studio:plantillas'

export type SaveResult = { ok: true } | { ok: false; reason: 'full' | 'unavailable' }

/**
 * The template library, kept in the browser.
 *
 * This is the only thing MD Studio persists — everything else lives and dies
 * with the tab. So the module assumes the worst about its storage: it can be
 * switched off (private windows, blocked cookies), it can be full, and it can
 * hold whatever an older version of this app wrote there. None of that is
 * exceptional enough to break the panel trying to display it, so nothing here
 * throws: reads degrade to an empty library, and writes report why they failed.
 */
export function listTemplates(): DocTemplate[] {
  let raw: string | null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return []
  }
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []

  // Entry by entry, so one unreadable template doesn't cost the user the rest
  // of a library they can't otherwise recover.
  return parsed
    .map((entry) => parseTemplate(JSON.stringify(entry)))
    .filter((template): template is DocTemplate => template !== null)
}

/** The name identifies a template, so saving over one replaces it. */
export function saveTemplate(template: DocTemplate): SaveResult {
  const next = [...listTemplates().filter((t) => t.name !== template.name), template]
  return write(next)
}

export function deleteTemplate(name: string): void {
  write(listTemplates().filter((t) => t.name !== name))
}

function write(templates: DocTemplate[]): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(templates))
    return { ok: true }
  } catch (error) {
    // A cover carries its logos as data, so a handful of templates can fill the
    // quota. That is a normal outcome here, not a bug, and the difference from
    // "storage is switched off" is what decides which advice to give.
    return { ok: false, reason: isQuotaError(error) ? 'full' : 'unavailable' }
  }
}

function isQuotaError(error: unknown): boolean {
  return (
    error instanceof DOMException &&
    (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED')
  )
}
