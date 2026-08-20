import { describe, expect, test } from 'vitest'
import { htmlToMarkdown } from './htmlToMarkdown'
import { renderMarkdownToHtml } from './markdown'

/**
 * The loop the user actually rides: Markdown is rendered into the editable
 * preview, the browser hands back HTML, and that becomes the new Markdown. A
 * gap anywhere in it deletes the user's content while they type, which is why
 * these tests assert on structure surviving rather than on exact formatting.
 */
const roundTrip = (markdown: string) => htmlToMarkdown(renderMarkdownToHtml(markdown))

const lines = (...ls: string[]) => ls.join('\n')

function columnsOf(markdown: string): HTMLElement[] {
  const host = document.createElement('div')
  host.innerHTML = renderMarkdownToHtml(markdown)
  return Array.from(host.querySelectorAll<HTMLElement>('.md-cols > .md-col'))
}

/** Converts an already-edited DOM back to Markdown, the way the preview does. */
function fromHtml(html: string): string {
  return htmlToMarkdown(html)
}

describe('a columns row survives the round trip', () => {
  const source = lines('::: columnas', ':: col 60', 'izquierda', ':: col 40', 'derecha', ':::')

  test('comes back as a columns row, not as loose text', () => {
    const back = roundTrip(source)

    expect(back).toContain('::: columnas')
    expect(back).toContain(':: col 60')
    expect(back).toContain(':: col 40')
  })

  test('keeps both columns, their widths and their content', () => {
    const columns = columnsOf(roundTrip(source))

    expect(columns).toHaveLength(2)
    expect(columns[0].getAttribute('data-w')).toBe('60')
    expect(columns[1].getAttribute('data-w')).toBe('40')
    expect(columns[0].textContent).toContain('izquierda')
    expect(columns[1].textContent).toContain('derecha')
  })

  test('settles: a second trip changes nothing', () => {
    const once = roundTrip(source)
    expect(roundTrip(once)).toBe(once)
  })

  test('keeps the vertical alignment', () => {
    const back = roundTrip(lines('::: columnas centro', ':: col', 'a', ':: col', 'b', ':::'))
    expect(back).toContain('::: columnas centro')
  })

  test('keeps a heading, a list and a quote nested in a column', () => {
    const nested = lines(
      '::: columnas',
      ':: col 50',
      '### Un título',
      '',
      '- uno',
      '- dos',
      ':: col 50',
      '> una cita',
      ':::',
    )

    const columns = columnsOf(roundTrip(nested))
    expect(columns[0].querySelector('h3')?.textContent).toBe('Un título')
    expect(columns[0].querySelectorAll('li')).toHaveLength(2)
    expect(columns[1].querySelector('blockquote')).not.toBeNull()
  })

  test('keeps a code block inside a column, fence marker and all', () => {
    const withCode = lines('::: columnas', ':: col', '```', 'const a = 1', '```', ':: col', 'b', ':::')

    const columns = columnsOf(roundTrip(withCode))
    expect(columns).toHaveLength(2)
    expect(columns[0].querySelector('pre')?.textContent).toContain('const a = 1')
  })

  test('keeps a resized image inside a column at its width', () => {
    const withImage = lines('::: columnas', ':: col', '![foto](foto.png#w=220)', ':: col', 'b', ':::')

    const back = roundTrip(withImage)
    expect(back).toContain('foto.png#w=220')
    expect(columnsOf(back)[0].querySelector('img')?.style.width).toBe('220px')
  })
})

describe('rows the browser mangled while editing', () => {
  test('an emptied column keeps its place, so the widths still add up', () => {
    const html =
      '<div class="md-cols" data-cols data-align="arriba" contenteditable="false">' +
      '<div class="md-col" data-w="60" contenteditable="true"><p>queda</p></div>' +
      '<div class="md-col" data-w="40" contenteditable="true"></div>' +
      '</div>'

    const back = fromHtml(html)
    expect(back).toContain(':: col 60')
    expect(back).toContain(':: col 40')
  })

  test('a row down to one column becomes ordinary content, keeping the text', () => {
    const html =
      '<div class="md-cols" data-cols data-align="arriba" contenteditable="false">' +
      '<div class="md-col" data-w="100" contenteditable="true"><p>solo yo</p></div>' +
      '</div>'

    const back = fromHtml(html)
    expect(back).toContain('solo yo')
    expect(back).not.toContain('::: columnas')
  })

  test('an empty wrapper leaves nothing behind', () => {
    const html = '<div class="md-cols" data-cols data-align="arriba" contenteditable="false"></div>'
    expect(fromHtml(html).trim()).toBe('')
  })

  test('text stranded inside the wrapper but outside every column is kept', () => {
    const html =
      '<div class="md-cols" data-cols data-align="arriba" contenteditable="false">' +
      '<div class="md-col" data-w="50" contenteditable="true"><p>a</p></div>' +
      '<div class="md-col" data-w="50" contenteditable="true"><p>b</p></div>' +
      'perdido' +
      '</div>'

    expect(fromHtml(html)).toContain('perdido')
  })
})

describe('documents without columns are untouched', () => {
  test('headings, lists, tables, quotes and page breaks round-trip as before', () => {
    const doc = lines(
      '# Título',
      '',
      '- uno',
      '- dos',
      '',
      '| a | b |',
      '| --- | --- |',
      '| 1 | 2 |',
      '',
      '> cita',
      '',
      '<!-- pagebreak -->',
      '',
      'final',
    )

    const back = roundTrip(doc)
    expect(back).toContain('# Título')
    expect(back).toMatch(/-\s+uno/) // Turndown pads its bullets; that is existing behaviour
    expect(back).toContain('| a | b |')
    expect(back).toContain('> cita')
    expect(back).toContain('<!-- pagebreak -->')
    expect(back).toContain('final')
    expect(back).not.toContain('md-cols')
    expect(roundTrip(back)).toBe(back)
  })
})

describe('content the browser dropped somewhere odd', () => {
  test('an image dropped onto a page break is kept, not swallowed by it', () => {
    // Dragging an image around the preview hands it to the browser's own
    // contentEditable move, which will happily park it inside the page-break
    // node. The break must not eat what landed in it.
    const html =
      '<p>antes</p>' +
      '<div class="page-break" data-page-break contenteditable="false">' +
      '<span class="page-break-label">Salto de página</span>' +
      '<img src="logo.png" alt="Logo">' +
      '</div>'

    const back = fromHtml(html)

    expect(back).toContain('logo.png')
    expect(back).toContain('<!-- pagebreak -->')
    expect(back).toContain('antes')
  })

  test('the page break label is never mistaken for content', () => {
    const html =
      '<div class="page-break" data-page-break contenteditable="false">' +
      '<span class="page-break-label">Salto de página</span></div>'

    expect(fromHtml(html)).not.toContain('Salto de página')
  })
})
