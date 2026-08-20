import { describe, expect, test } from 'vitest'
import { applyTemplate, parseTemplate, serializeTemplate, templateFromDoc } from './docTemplate'
import { makeDocId, type DocFile } from './docFile'
import { DEFAULT_SETTINGS } from './settings'

const COVER = ['::: lienzo', ':: en 30,15 18', '![Logo](logo.png)', ':::'].join('\n')

function doc(overrides: Partial<DocFile> = {}): DocFile {
  return {
    id: makeDocId(),
    name: 'informe-trimestral',
    markdown: '# Contenido propio\n\nUn párrafo que nadie debe tocar.',
    settings: { ...DEFAULT_SETTINGS, coverPage: { enabled: true, content: COVER } },
    ...overrides,
  }
}

describe('templateFromDoc', () => {
  test('takes the cover and the style that renders it', () => {
    const template = templateFromDoc(doc({ settings: { ...DEFAULT_SETTINGS, themeId: 'ocean', fontSizePt: 14, coverPage: { enabled: true, content: COVER } } }), 'Portada Algoritmo')

    expect(template.name).toBe('Portada Algoritmo')
    expect(template.cover).toBe(COVER)
    expect(template.style.themeId).toBe('ocean')
    expect(template.style.fontSizePt).toBe(14)
  })

  test('does not carry the source document along', () => {
    const template = templateFromDoc(doc(), 'X')
    expect(JSON.stringify(template)).not.toContain('Un párrafo que nadie debe tocar')
  })
})

describe('applyTemplate', () => {
  const template = templateFromDoc(
    doc({ settings: { ...DEFAULT_SETTINGS, themeId: 'ocean', coverPage: { enabled: true, content: COVER } } }),
    'Portada Algoritmo',
  )

  test('gives the document the cover and the style', () => {
    const target = applyTemplate(doc({ settings: DEFAULT_SETTINGS }), template)

    expect(target.settings.coverPage.content).toBe(COVER)
    expect(target.settings.themeId).toBe('ocean')
  })

  test('leaves the content, the name and the identity of the document alone', () => {
    // Applying to twenty files must not touch a line of anyone's writing.
    const before = doc()
    const after = applyTemplate(before, template)

    expect(after.markdown).toBe(before.markdown)
    expect(after.name).toBe(before.name)
    expect(after.id).toBe(before.id)
  })

  test('switches the cover on, since an invisible cover is no use', () => {
    const target = applyTemplate(
      doc({ settings: { ...DEFAULT_SETTINGS, coverPage: { enabled: false, content: '' } } }),
      template,
    )

    expect(target.settings.coverPage.enabled).toBe(true)
  })

  test('does not mutate the document it was given', () => {
    const before = doc({ settings: DEFAULT_SETTINGS })
    const snapshot = structuredClone(before)

    applyTemplate(before, template)

    expect(before).toEqual(snapshot)
  })
})

describe('serializeTemplate and parseTemplate', () => {
  test('a template survives being written to a file and read back', () => {
    const template = templateFromDoc(doc(), 'Portada Algoritmo')
    expect(parseTemplate(serializeTemplate(template))).toEqual(template)
  })

  test('keeps an embedded image, so the logos travel with it', () => {
    const withLogo = ['::: lienzo', ':: en 0,0 20', '![L](data:image/png;base64,AAAA)', ':::'].join('\n')
    const template = templateFromDoc(
      doc({ settings: { ...DEFAULT_SETTINGS, coverPage: { enabled: true, content: withLogo } } }),
      'Con logo',
    )

    expect(parseTemplate(serializeTemplate(template))?.cover).toContain('data:image/png;base64,AAAA')
  })
})

describe('parseTemplate refuses what is not a template', () => {
  // Whatever comes through here is a file the user picked. It can be anything.
  test('returns null for text that is not JSON, without throwing', () => {
    expect(parseTemplate('esto no es json {{{')).toBeNull()
  })

  test('returns null for JSON that is not a template', () => {
    expect(parseTemplate('{"hola":"mundo"}')).toBeNull()
    expect(parseTemplate('[1,2,3]')).toBeNull()
    expect(parseTemplate('null')).toBeNull()
    expect(parseTemplate('"texto"')).toBeNull()
  })

  test('returns null for a version it does not know', () => {
    const template = templateFromDoc(doc(), 'X')
    const future = JSON.stringify({ ...template, version: 99 })

    expect(parseTemplate(future)).toBeNull()
  })

  test('returns null when a required field is missing', () => {
    const template = templateFromDoc(doc(), 'X')
    for (const field of ['name', 'cover', 'style'] as const) {
      const broken = { ...template }
      delete (broken as Record<string, unknown>)[field]
      expect(parseTemplate(JSON.stringify(broken))).toBeNull()
    }
  })

  test('returns null when the style is not an object', () => {
    const template = templateFromDoc(doc(), 'X')
    expect(parseTemplate(JSON.stringify({ ...template, style: 'grande' }))).toBeNull()
  })

  test('fills in style fields the file happens to be missing', () => {
    // A template from an older build should still apply, using the defaults for
    // whatever it does not mention, rather than being rejected outright.
    const template = templateFromDoc(doc(), 'X')
    const sparse = JSON.stringify({ ...template, style: { themeId: 'ocean' } })

    const parsed = parseTemplate(sparse)
    expect(parsed?.style.themeId).toBe('ocean')
    expect(parsed?.style.fontSizePt).toBe(DEFAULT_SETTINGS.fontSizePt)
  })
})
