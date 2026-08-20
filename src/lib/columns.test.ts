import { describe, expect, test } from 'vitest'
import { buildRowHtml, isRowClose, normalizeWidths, parseColLine, parseRowOpen } from './columns'

describe('parseRowOpen', () => {
  test('recognizes a bare row opener, defaulting to top alignment', () => {
    expect(parseRowOpen('::: columnas')).toEqual({ align: 'arriba' })
  })

  test('reads the vertical alignment when given', () => {
    expect(parseRowOpen('::: columnas centro')).toEqual({ align: 'centro' })
    expect(parseRowOpen('::: columnas abajo')).toEqual({ align: 'abajo' })
  })

  test('falls back to top alignment for an unknown keyword', () => {
    expect(parseRowOpen('::: columnas patatas')).toEqual({ align: 'arriba' })
  })

  test('rejects a container that is not a columns row', () => {
    expect(parseRowOpen('::: aviso')).toBeNull()
    expect(parseRowOpen(':::')).toBeNull()
    expect(parseRowOpen('texto normal')).toBeNull()
  })
})

describe('isRowClose', () => {
  test('recognizes the closing fence', () => {
    expect(isRowClose(':::')).toBe(true)
    expect(isRowClose('  :::  ')).toBe(true)
  })

  test('rejects anything else on the line', () => {
    expect(isRowClose('::: columnas')).toBe(false)
    expect(isRowClose(':::: ')).toBe(false)
  })
})

describe('parseColLine', () => {
  test('recognizes a column with no width', () => {
    expect(parseColLine(':: col')).toEqual({ widthPercent: null })
  })

  test('reads an explicit width percentage', () => {
    expect(parseColLine(':: col 60')).toEqual({ widthPercent: 60 })
  })

  test('tolerates surrounding whitespace', () => {
    expect(parseColLine('  :: col 60  ')).toEqual({ widthPercent: 60 })
  })

  test('treats an unreadable width as no width, still a column', () => {
    expect(parseColLine(':: col abc')).toEqual({ widthPercent: null })
  })

  test('rejects lines that are not column markers', () => {
    expect(parseColLine(':: cols')).toBeNull()
    expect(parseColLine('::col')).toBeNull()
    expect(parseColLine('texto')).toBeNull()
  })
})

describe('normalizeWidths', () => {
  test('splits evenly when no width is given', () => {
    expect(normalizeWidths([null, null])).toEqual([50, 50])
  })

  test('leaves widths that already add up to 100 alone', () => {
    expect(normalizeWidths([60, 40])).toEqual([60, 40])
  })

  test('gives an unnumbered column what is left of 100', () => {
    expect(normalizeWidths([60, null])).toEqual([60, 40])
  })

  test('scales proportionally when the numbers overshoot 100', () => {
    expect(normalizeWidths([70, 70])).toEqual([50, 50])
  })

  test('raises a column below the minimum and rescales the rest', () => {
    expect(normalizeWidths([3, 97])).toEqual([10, 90])
  })

  test('always adds up to exactly 100, even when it does not divide evenly', () => {
    // Which column absorbs the leftover point is arbitrary; that none is lost
    // and that the three stay within a point of each other is not.
    const three = normalizeWidths([null, null, null])
    expect(three.reduce((a, b) => a + b, 0)).toBe(100)
    expect(Math.max(...three) - Math.min(...three)).toBe(1)
  })

  test('returns whole numbers', () => {
    for (const w of normalizeWidths([55, null, null])) {
      expect(Number.isInteger(w)).toBe(true)
    }
  })

  test('handles an empty row', () => {
    expect(normalizeWidths([])).toEqual([])
  })

  test('falls back to equal shares when the minimum cannot be honoured', () => {
    const many = normalizeWidths(Array.from({ length: 12 }, () => null))
    expect(many.reduce((a, b) => a + b, 0)).toBe(100)
  })
})

describe('buildRowHtml', () => {
  test('produces a non-editable wrapper holding editable columns', () => {
    const html = buildRowHtml([{ widthPercent: 60 }, { widthPercent: 40 }], 'arriba')

    expect(html).toContain('class="md-cols"')
    expect(html).toContain('data-cols')
    expect(html).toContain('data-align="arriba"')
    expect(html).toContain('contenteditable="false"')
    expect(html).toContain('data-w="60"')
    expect(html).toContain('data-w="40"')
  })

  test('carries the inner HTML of each column through untouched', () => {
    const html = buildRowHtml(
      [{ widthPercent: 50, html: '<p>izquierda</p>' }, { widthPercent: 50, html: '<p>derecha</p>' }],
      'centro',
    )

    expect(html).toContain('<p>izquierda</p>')
    expect(html).toContain('<p>derecha</p>')
    expect(html).toContain('data-align="centro"')
  })

  test('normalizes the widths it is handed', () => {
    const html = buildRowHtml([{ widthPercent: null }, { widthPercent: null }], 'arriba')

    expect(html).toContain('data-w="50"')
    expect(html).not.toContain('data-w="null"')
  })
})
