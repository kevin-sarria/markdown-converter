import { describe, expect, test } from 'vitest'
import {
  buildCanvasHtml,
  clampItem,
  formatItemLine,
  isCanvasOpen,
  parseItemLine,
  type CanvasItem,
} from './canvas'

describe('isCanvasOpen', () => {
  test('recognizes a canvas page', () => {
    expect(isCanvasOpen('::: lienzo')).toBe(true)
    expect(isCanvasOpen('  ::: lienzo  ')).toBe(true)
  })

  test('rejects other containers', () => {
    expect(isCanvasOpen('::: columnas')).toBe(false)
    expect(isCanvasOpen(':::')).toBe(false)
    expect(isCanvasOpen('texto')).toBe(false)
  })
})

describe('parseItemLine', () => {
  test('reads position and width', () => {
    expect(parseItemLine(':: en 14,8 22')).toEqual({ x: 14, y: 8, w: 22, h: null })
  })

  test('reads an explicit height', () => {
    expect(parseItemLine(':: en 14,8 22x30')).toEqual({ x: 14, y: 8, w: 22, h: 30 })
  })

  test('keeps the precision of a fraction of a percent', () => {
    expect(parseItemLine(':: en 14.5,8.25 22.5')).toEqual({ x: 14.5, y: 8.25, w: 22.5, h: null })
  })

  test('tolerates spacing around the comma', () => {
    expect(parseItemLine(':: en 14 , 8   22')).toEqual({ x: 14, y: 8, w: 22, h: null })
  })

  test('falls back to a sane box when the numbers are missing', () => {
    // A malformed line is still an item — dropping it would delete its content.
    expect(parseItemLine(':: en')).toEqual({ x: 0, y: 0, w: 100, h: null })
  })

  test('rejects lines that are not items', () => {
    expect(parseItemLine(':: col 50')).toBeNull()
    expect(parseItemLine('texto')).toBeNull()
  })
})

describe('formatItemLine', () => {
  test('writes back what it read', () => {
    const line = ':: en 14.5,8 22'
    expect(formatItemLine(parseItemLine(line)!)).toBe(line)
  })

  test('includes the height only when there is one', () => {
    expect(formatItemLine({ x: 1, y: 2, w: 3, h: 4 })).toBe(':: en 1,2 3x4')
    expect(formatItemLine({ x: 1, y: 2, w: 3, h: null })).toBe(':: en 1,2 3')
  })

  test('does not write trailing zeros', () => {
    expect(formatItemLine({ x: 10.0, y: 20.0, w: 30.0, h: null })).toBe(':: en 10,20 30')
  })

  test('rounds off floating point noise from dragging', () => {
    expect(formatItemLine({ x: 14.300000000000002, y: 8, w: 22, h: null })).toBe(':: en 14.3,8 22')
  })
})

describe('clampItem', () => {
  test('leaves a box that is already on the page alone', () => {
    const item: CanvasItem = { x: 10, y: 10, w: 30, h: 20 }
    expect(clampItem(item)).toEqual(item)
  })

  test('pulls a box back when it is dragged off the right edge', () => {
    // Something dragged off the page can never be reached again to drag back.
    expect(clampItem({ x: 95, y: 10, w: 30, h: null }).x).toBe(70)
  })

  test('pulls a box back when it is dragged off the top or left', () => {
    const item = clampItem({ x: -20, y: -10, w: 30, h: 10 })
    expect(item.x).toBe(0)
    expect(item.y).toBe(0)
  })

  test('never shrinks a box below something clickable', () => {
    expect(clampItem({ x: 0, y: 0, w: 0.1, h: 0.1 }).w).toBeGreaterThanOrEqual(2)
  })

  test('caps a box at the size of the page', () => {
    expect(clampItem({ x: 0, y: 0, w: 500, h: null }).w).toBe(100)
  })
})

describe('buildCanvasHtml', () => {
  test('positions each item with its own box', () => {
    const html = buildCanvasHtml([
      { x: 14, y: 8, w: 22, h: null, html: '<p>A</p>' },
      { x: 40, y: 8, w: 22, h: 22, html: '<p>B</p>' },
    ])

    expect(html).toContain('data-canvas')
    expect(html).toContain('contenteditable="false"')
    expect(html).toContain('data-x="14"')
    expect(html).toContain('left: 14%')
    expect(html).toContain('top: 8%')
    expect(html).toContain('width: 22%')
    expect(html).toContain('<p>A</p>')
    expect(html).toContain('<p>B</p>')
  })

  test('gives an item without a height room to grow with its content', () => {
    const html = buildCanvasHtml([{ x: 0, y: 0, w: 50, h: null, html: '<p>A</p>' }])
    expect(html).not.toContain('height:')
  })

  test('marks each item editable so text inside can be typed', () => {
    const html = buildCanvasHtml([{ x: 0, y: 0, w: 50, h: null, html: '<p>A</p>' }])
    expect(html).toContain('contenteditable="true"')
  })
})
