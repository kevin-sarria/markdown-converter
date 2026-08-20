import { describe, expect, test } from 'vitest'
import { htmlToMarkdown } from './htmlToMarkdown'
import { renderMarkdownToHtml } from './markdown'

const lines = (...ls: string[]) => ls.join('\n')
const roundTrip = (markdown: string) => htmlToMarkdown(renderMarkdownToHtml(markdown))

function itemsOf(markdown: string): HTMLElement[] {
  const host = document.createElement('div')
  host.innerHTML = renderMarkdownToHtml(markdown)
  return Array.from(host.querySelectorAll<HTMLElement>('.md-canvas > .md-canvas-item'))
}

const COVER = lines(
  '::: lienzo',
  ':: en 14,8 22',
  '![Logo A](a.png)',
  ':: en 44,8 22',
  '![Logo B](b.png)',
  ':: en 10,45 80',
  '## Entorno de producción',
  ':::',
)

describe('rendering a canvas page', () => {
  test('places every item at the position it was given', () => {
    const items = itemsOf(COVER)

    expect(items).toHaveLength(3)
    expect(items[0].style.left).toBe('14%')
    expect(items[0].style.top).toBe('8%')
    expect(items[0].style.width).toBe('22%')
    expect(items[1].style.left).toBe('44%')
  })

  test('parses each item with the full Markdown parser', () => {
    const items = itemsOf(COVER)

    expect(items[0].querySelector('img')?.getAttribute('src')).toBe('a.png')
    expect(items[2].querySelector('h2')?.textContent).toBe('Entorno de producción')
  })

  test('leaves the page and its items uneditable, so a drag is ours to handle', () => {
    const host = document.createElement('div')
    host.innerHTML = renderMarkdownToHtml(COVER)
    const canvas = host.querySelector<HTMLElement>('.md-canvas')!

    expect(canvas.getAttribute('contenteditable')).toBe('false')
    for (const item of itemsOf(COVER)) {
      expect(item.getAttribute('contenteditable')).toBeNull()
    }
  })

  test('does not let a fence inside an item truncate the page', () => {
    const html = renderMarkdownToHtml(
      lines('::: lienzo', ':: en 0,0 50', '```', ':::', '```', ':: en 50,0 50', 'sobrevivi', ':::'),
    )
    expect(html).toContain('sobrevivi')
    expect((html.match(/md-canvas-item/g) ?? []).length).toBe(2)
  })

  test('leaves a canvas with no items as ordinary text', () => {
    const html = renderMarkdownToHtml(lines('::: lienzo', 'solo texto', ':::'))
    expect(html).not.toContain('md-canvas')
    expect(html).toContain('solo texto')
  })

  test('leaves an unclosed canvas as ordinary text, losing nothing', () => {
    const html = renderMarkdownToHtml(lines('::: lienzo', ':: en 0,0 50', 'a medio escribir'))
    expect(html).not.toContain('md-canvas')
    expect(html).toContain('a medio escribir')
  })
})

describe('a canvas page survives the round trip', () => {
  test('comes back with the same items at the same positions', () => {
    const back = roundTrip(COVER)

    // Re-rendering the result is what proves it came back as a canvas and not
    // as text that merely happens to contain the same characters.
    const items = itemsOf(back)
    expect(items).toHaveLength(3)
    expect(items.map((i) => [i.style.left, i.style.top, i.style.width])).toEqual([
      ['14%', '8%', '22%'],
      ['44%', '8%', '22%'],
      ['10%', '45%', '80%'],
    ])
    expect(items[0].querySelector('img')?.getAttribute('src')).toBe('a.png')
    expect(items[2].textContent).toContain('Entorno de producción')
  })

  test('settles: a second trip changes nothing', () => {
    const once = roundTrip(COVER)
    expect(roundTrip(once)).toBe(once)
  })

  test('keeps a pinned height', () => {
    const back = roundTrip(lines('::: lienzo', ':: en 0,0 40x30', 'texto', ':::'))
    expect(itemsOf(back)[0]?.style.height).toBe('30%')
  })

  test('keeps the size, colour, alignment and typeface of a box', () => {
    const styled = lines(
      '::: lienzo',
      ':: en 15,48 70 size=26 color=#0b2a6b align=centro font=titulo',
      '**Entorno de producción**',
      ':::',
    )

    const back = roundTrip(styled)
    expect(back).toContain('size=26')
    expect(back).toContain('color=#0b2a6b')
    expect(back).toContain('align=centro')
    expect(back).toContain('font=titulo')

    const item = itemsOf(back)[0]
    expect(item.style.fontSize).toBe('26pt')
    expect(item.style.textAlign).toBe('center')
    expect(item.querySelector('strong')).not.toBeNull()
  })

  test('a box that was never styled stays that way', () => {
    const back = roundTrip(lines('::: lienzo', ':: en 10,10 30', 'texto', ':::'))

    expect(back).toContain(':: en 10,10 30')
    expect(back).not.toContain('size=')
    expect(back).not.toContain('color=')
  })

  test('keeps an item the user emptied, so its place is not lost', () => {
    const html =
      '<div class="md-canvas" data-canvas contenteditable="false">' +
      '<div class="md-canvas-item" data-canvas-item data-x="10" data-y="10" data-w="30"></div>' +
      '<div class="md-canvas-item" data-canvas-item data-x="50" data-y="10" data-w="30"><p>b</p></div>' +
      '</div>'

    const back = htmlToMarkdown(html)
    expect(back).toContain(':: en 10,10 30')
    expect(back).toContain(':: en 50,10 30')
  })

  test('keeps content the browser stranded between items', () => {
    const html =
      '<div class="md-canvas" data-canvas contenteditable="false">' +
      '<div class="md-canvas-item" data-canvas-item data-x="0" data-y="0" data-w="30"><p>a</p></div>' +
      'perdido</div>'

    expect(htmlToMarkdown(html)).toContain('perdido')
  })

  test('a canvas and a columns row can live in the same document', () => {
    const both = lines(
      '::: lienzo',
      ':: en 0,0 50',
      'lienzo',
      ':::',
      '',
      '::: columnas',
      ':: col 50',
      'izquierda',
      ':: col 50',
      'derecha',
      ':::',
    )

    const host = document.createElement('div')
    host.innerHTML = renderMarkdownToHtml(roundTrip(both))

    expect(host.querySelectorAll('.md-canvas-item')).toHaveLength(1)
    expect(host.querySelectorAll('.md-cols > .md-col')).toHaveLength(2)
    expect(host.textContent).toContain('izquierda')
  })
})
