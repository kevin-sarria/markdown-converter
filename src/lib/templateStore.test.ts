import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { deleteTemplate, listTemplates, saveTemplate, STORAGE_KEY } from './templateStore'
import { templateFromDoc } from './docTemplate'
import { makeDocId } from './docFile'
import { DEFAULT_SETTINGS } from './settings'

const make = (name: string) =>
  templateFromDoc(
    {
      id: makeDocId(),
      name: 'x',
      markdown: '',
      settings: { ...DEFAULT_SETTINGS, coverPage: { enabled: true, content: `portada de ${name}` } },
    },
    name,
  )

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('the template library', () => {
  test('starts empty', () => {
    expect(listTemplates()).toEqual([])
  })

  test('keeps what it is given', () => {
    expect(saveTemplate(make('Portada A'))).toEqual({ ok: true })

    const saved = listTemplates()
    expect(saved).toHaveLength(1)
    expect(saved[0].name).toBe('Portada A')
    expect(saved[0].cover).toBe('portada de Portada A')
  })

  test('survives a reload — that is the whole point of it', () => {
    saveTemplate(make('Portada A'))
    // A fresh read of the same storage is what a reload amounts to here.
    expect(listTemplates()[0].name).toBe('Portada A')
  })

  test('saving over an existing name replaces it instead of duplicating', () => {
    saveTemplate(make('Portada A'))
    saveTemplate(make('Portada A'))

    expect(listTemplates()).toHaveLength(1)
  })

  test('deletes by name and leaves the rest', () => {
    saveTemplate(make('A'))
    saveTemplate(make('B'))

    deleteTemplate('A')

    expect(listTemplates().map((t) => t.name)).toEqual(['B'])
  })
})

describe('the library when storage misbehaves', () => {
  test('one corrupt entry does not take the whole library down', () => {
    saveTemplate(make('Buena'))
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY)!)
    stored.push({ garbage: true })
    stored.push('ni siquiera un objeto')
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored))

    // The good one still lists; the unreadable ones are simply skipped.
    expect(listTemplates().map((t) => t.name)).toEqual(['Buena'])
  })

  test('storage holding something that is not a list reads as empty', () => {
    localStorage.setItem(STORAGE_KEY, 'no soy json')
    expect(listTemplates()).toEqual([])

    localStorage.setItem(STORAGE_KEY, '{"no":"una lista"}')
    expect(listTemplates()).toEqual([])
  })

  test('a full quota is reported, not thrown', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded', 'QuotaExceededError')
    })

    expect(saveTemplate(make('Grande'))).toEqual({ ok: false, reason: 'full' })
  })

  test('storage being unavailable is reported, not thrown', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('localStorage is disabled')
    })

    expect(saveTemplate(make('X'))).toEqual({ ok: false, reason: 'unavailable' })
  })

  test('reading with storage unavailable gives an empty library, not a crash', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('localStorage is disabled')
    })

    expect(listTemplates()).toEqual([])
  })
})
