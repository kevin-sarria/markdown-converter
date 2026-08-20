import type { DocFile } from './docFile'
import { DEFAULT_SETTINGS, type DocSettings } from './settings'

/**
 * A cover page saved for reuse: the layout itself plus the style that makes it
 * look the way it does.
 *
 * The style travels with it deliberately. A `::: lienzo` positions everything in
 * percentages of the page, so the layout survives a change of page size — but
 * the typeface, the palette and the margins still decide what the result looks
 * like, and a cover applied to a document with different ones is not the cover
 * you saved.
 *
 * Images inside the cover are `data:` URIs (see imageOptimize.ts), so a template
 * carries its own logos. That is what lets one open on another machine without
 * hunting for files — at the cost of size, which matters for the browser
 * library (see templateStore.ts) and not at all for a downloaded file.
 */
export interface DocTemplate {
  /** Only bumped if the shape stops being readable by an older build. */
  version: 1
  name: string
  /** ISO 8601. */
  createdAt: string
  /** The cover's Markdown — normally a `::: lienzo` block. */
  cover: string
  /** Everything that decides how it renders, except the cover itself. */
  style: TemplateStyle
}

export type TemplateStyle = Omit<DocSettings, 'coverPage'>

export const TEMPLATE_VERSION = 1
export const TEMPLATE_FILE_SUFFIX = '.plantilla.json'

export function templateFromDoc(doc: DocFile, name: string): DocTemplate {
  const { coverPage, ...style } = doc.settings
  return {
    version: TEMPLATE_VERSION,
    name,
    createdAt: new Date().toISOString(),
    cover: coverPage.content,
    style,
  }
}

/**
 * A copy of `doc` wearing the template's cover and style, with its own writing
 * untouched.
 *
 * Leaving `markdown`, `name` and `id` alone is the point of this function, not a
 * detail of it: applying a template to twenty files at once must not alter a
 * line of anyone's content, and there is no undo in this editor to walk it back.
 */
export function applyTemplate(doc: DocFile, template: DocTemplate): DocFile {
  return {
    ...doc,
    settings: {
      ...template.style,
      // A cover that isn't switched on is invisible, and the target document may
      // well have had it off.
      coverPage: { enabled: true, content: template.cover },
    },
  }
}

export function serializeTemplate(template: DocTemplate): string {
  return JSON.stringify(template, null, 2)
}

/**
 * Reads a template, or returns null. Never throws.
 *
 * Everything reaching this function is a file somebody picked from their disk,
 * or a string recovered from browser storage that another version of this app
 * may have written. Neither is trustworthy, and a parse error here would take
 * down the panel that is trying to show the problem.
 */
export function parseTemplate(text: string): DocTemplate | null {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return null
  }

  if (!isRecord(raw)) return null
  if (raw.version !== TEMPLATE_VERSION) return null
  if (typeof raw.name !== 'string' || typeof raw.cover !== 'string') return null
  if (!isRecord(raw.style)) return null

  return {
    version: TEMPLATE_VERSION,
    name: raw.name,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : new Date().toISOString(),
    cover: raw.cover,
    // Merged over the defaults rather than trusted wholesale: a template written
    // by an older build is missing whatever was added since, and rejecting it
    // for that would be throwing away a perfectly usable cover.
    style: { ...defaultStyle(), ...(raw.style as Partial<TemplateStyle>) },
  }
}

function defaultStyle(): TemplateStyle {
  const { coverPage: _coverPage, ...style } = DEFAULT_SETTINGS
  return style
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A file name for a template, safe to write to disk. */
export function templateFileName(template: DocTemplate): string {
  const base = template.name.trim().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '')
  return `${base || 'plantilla'}${TEMPLATE_FILE_SUFFIX}`
}
