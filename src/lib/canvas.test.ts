import { describe, expect, test } from 'vitest'
import {
  buildCanvasHtml,
  clampItem,
  formatItemLine,
  isCanvasOpen,
  parseItemLine,
  readItem,
  type CanvasBox,
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
    expect(parseItemLine(':: en 14,8 22')).toMatchObject({ x: 14, y: 8, w: 22, h: null })
  })

  test('reads an explicit height', () => {
    expect(parseItemLine(':: en 14,8 22x30')).toMatchObject({ x: 14, y: 8, w: 22, h: 30 })
  })

  test('keeps the precision of a fraction of a percent', () => {
    expect(parseItemLine(':: en 14.5,8.25 22.5')).toMatchObject({ x: 14.5, y: 8.25, w: 22.5, h: null })
  })

  test('tolerates spacing around the comma', () => {
    expect(parseItemLine(':: en 14 , 8   22')).toMatchObject({ x: 14, y: 8, w: 22, h: null })
  })

  test('falls back to a sane box when the numbers are missing', () => {
    // A malformed line is still an item — dropping it would delete its content.
    expect(parseItemLine(':: en')).toMatchObject({ x: 0, y: 0, w: 100, h: null })
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
    const item: CanvasBox = { x: 10, y: 10, w: 30, h: 20 }
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

  test('leaves items uneditable, so a drag moves the box instead of the text', () => {
    // The whole point of a canvas is dragging. An editable item hands the drag
    // to the browser's contentEditable machinery, which moves the *node* to
    // wherever it decides — the behaviour this mode exists to get away from.
    // Double-clicking an item is what turns text editing on (useCanvasEditor).
    const html = buildCanvasHtml([{ x: 0, y: 0, w: 50, h: null, html: '<p>A</p>' }])
    expect(html).not.toContain('contenteditable="true"')
  })
})

describe('readItem', () => {
  const element = (attrs: Record<string, string>) => {
    const el = document.createElement('div')
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    return el
  }

  test('reads the box off the attributes', () => {
    expect(readItem(element({ 'data-x': '14', 'data-y': '8', 'data-w': '22', 'data-h': '30' }))).toMatchObject({
      x: 14,
      y: 8,
      w: 22,
      h: 30,
    })
  })

  test('an item with no pinned height still has no pinned height', () => {
    // Number(null) is 0, not NaN — read carelessly, a missing height becomes a
    // height of zero, gets clamped up to the minimum, and every item in the
    // document silently acquires a fixed height it never had.
    expect(readItem(element({ 'data-x': '10', 'data-y': '10', 'data-w': '30' })).h).toBeNull()
  })

  test('survives attributes that are not numbers', () => {
    const item = readItem(element({ 'data-x': 'abc', 'data-y': '', 'data-w': 'x' }))
    expect(Number.isFinite(item.x)).toBe(true)
    expect(Number.isFinite(item.w)).toBe(true)
  })
})

describe('item style in the marker line', () => {
  test('reads size, colour, alignment and typeface', () => {
    const item = parseItemLine(':: en 15,48 70 size=26 color=#0b2a6b align=centro font=titulo')!

    expect(item.x).toBe(15)
    expect(item.w).toBe(70)
    expect(item.style).toEqual({ sizePt: 26, color: '#0b2a6b', align: 'centro', font: 'titulo' })
  })

  test('an item without style has none, not a made-up default', () => {
    expect(parseItemLine(':: en 10,10 30')!.style).toEqual({
      sizePt: null,
      color: null,
      align: null,
      font: null,
    })
  })

  test('reads a partial style and leaves the rest alone', () => {
    expect(parseItemLine(':: en 10,10 30 color=#fff')!.style).toEqual({
      sizePt: null,
      color: '#fff',
      align: null,
      font: null,
    })
  })

  test('still reads a pinned height alongside the style', () => {
    const item = parseItemLine(':: en 10,10 30x20 size=12')!
    expect(item.h).toBe(20)
    expect(item.style.sizePt).toBe(12)
  })

  test('refuses a colour that is not a plain hex value', () => {
    // This string ends up inside a style attribute. Anything but a hex colour
    // is a way into the page's CSS, so it is dropped rather than sanitised.
    for (const bad of ['red;background:url(x)', 'javascript:alert(1)', 'rgb(1,2,3)', '#ggg', 'expression(1)']) {
      expect(parseItemLine(`:: en 0,0 50 color=${bad}`)!.style.color).toBeNull()
    }
  })

  test('accepts both short and long hex', () => {
    expect(parseItemLine(':: en 0,0 50 color=#FFF')!.style.color).toBe('#FFF')
    expect(parseItemLine(':: en 0,0 50 color=#0b2a6b')!.style.color).toBe('#0b2a6b')
  })

  test('ignores an alignment or typeface it does not know', () => {
    const style = parseItemLine(':: en 0,0 50 align=diagonal font=comic')!.style
    expect(style.align).toBeNull()
    expect(style.font).toBeNull()
  })

  test('keeps a font size within what a page can show', () => {
    expect(parseItemLine(':: en 0,0 50 size=0')!.style.sizePt).toBeNull()
    expect(parseItemLine(':: en 0,0 50 size=9999')!.style.sizePt).toBe(200)
    expect(parseItemLine(':: en 0,0 50 size=abc')!.style.sizePt).toBeNull()
  })
})

describe('writing the style back', () => {
  test('a styled item survives being written and read again', () => {
    const line = ':: en 15,48 70 size=26 color=#0b2a6b align=centro font=titulo'
    expect(formatItemLine(parseItemLine(line)!)).toBe(line)
  })

  test('writes nothing for a style that was never set', () => {
    expect(formatItemLine(parseItemLine(':: en 10,10 30')!)).toBe(':: en 10,10 30')
  })

  test('writes only the parts that are set', () => {
    expect(formatItemLine(parseItemLine(':: en 10,10 30 size=14')!)).toBe(':: en 10,10 30 size=14')
  })
})

describe('rendering a styled item', () => {
  test('turns the style into the box\u2019s own CSS', () => {
    const html = buildCanvasHtml([
      {
        x: 0,
        y: 0,
        w: 50,
        h: null,
        style: { sizePt: 26, color: '#0b2a6b', align: 'centro', font: 'titulo' },
        html: '<p>A</p>',
      },
    ])

    expect(html).toContain('font-size: 26pt')
    expect(html).toContain('color: #0b2a6b')
    expect(html).toContain('text-align: center')
    expect(html).toContain('var(--p-font-heading)')
  })

  test('an unstyled item inherits the document, with no CSS of its own', () => {
    const html = buildCanvasHtml([{ x: 0, y: 0, w: 50, h: null, html: '<p>A</p>' }])

    expect(html).not.toContain('font-size')
    expect(html).not.toContain('text-align')
  })
})
