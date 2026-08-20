import { describe, expect, test } from 'vitest'
import { renderMarkdownToHtml } from './markdown'

const lines = (...ls: string[]) => ls.join('\n')

/** The rendered columns of a row, as real elements, so tests can assert what
 * ended up *inside* a column rather than merely somewhere on the page. */
function columnsOf(html: string): HTMLElement[] {
  const host = document.createElement('div')
  host.innerHTML = html
  return Array.from(host.querySelectorAll<HTMLElement>('.md-cols > .md-col'))
}

describe('rendering a columns row', () => {
  test('renders a wrapper holding one column per :: col', () => {
    const html = renderMarkdownToHtml(lines('::: columnas', ':: col 60', 'izquierda', ':: col 40', 'derecha', ':::'))

    expect(html).toContain('class="md-cols"')
    expect(html).toContain('data-w="60"')
    expect(html).toContain('data-w="40"')
    expect(html).toContain('izquierda')
    expect(html).toContain('derecha')
  })

  test('carries the vertical alignment onto the wrapper', () => {
    const html = renderMarkdownToHtml(lines('::: columnas centro', ':: col', 'a', ':: col', 'b', ':::'))
    expect(html).toContain('data-align="centro"')
  })

  test('parses each column with the full Markdown parser, not as plain text', () => {
    const html = renderMarkdownToHtml(
      lines(
        '::: columnas',
        ':: col 50',
        '### Un título',
        '',
        '- uno',
        '- dos',
        ':: col 50',
        '> una cita',
        ':::',
      ),
    )

    const [left, right] = columnsOf(html)
    expect(left.querySelector('h3')?.textContent).toBe('Un título')
    expect(left.querySelectorAll('li')).toHaveLength(2)
    expect(right.querySelector('blockquote')).not.toBeNull()
  })

  test('honours a resized image inside a column', () => {
    const html = renderMarkdownToHtml(lines('::: columnas', ':: col', '![foto](foto.png#w=220)', ':: col', 'b', ':::'))

    const img = columnsOf(html)[0].querySelector('img')
    expect(img?.style.width).toBe('220px')
  })

  test('does not let a fence inside a code block truncate the row', () => {
    const html = renderMarkdownToHtml(
      lines(
        '::: columnas',
        ':: col 50',
        '```',
        ':::',
        ':: col',
        '```',
        ':: col 50',
        'sobrevivi',
        ':::',
      ),
    )

    // The row must still have both columns and the text after the code block.
    expect(html).toContain('sobrevivi')
    expect((html.match(/class="md-col"/g) ?? []).length).toBe(2)
  })

  test('keeps content written before the first :: col', () => {
    const html = renderMarkdownToHtml(
      lines('::: columnas', 'huerfano', ':: col', 'a', ':: col', 'b', ':::'),
    )

    // Dropping it would silently delete the user's text; it joins the first column.
    expect(html).toContain('huerfano')
    expect(columnsOf(html)).toHaveLength(2)
  })

  test('leaves a container that has no columns as ordinary text', () => {
    const html = renderMarkdownToHtml(lines('::: columnas', 'solo texto', ':::'))

    expect(html).not.toContain('md-cols')
    expect(html).toContain('solo texto')
  })

  test('leaves an unclosed row as ordinary text, losing nothing', () => {
    const html = renderMarkdownToHtml(lines('::: columnas', ':: col', 'a medio escribir'))

    expect(html).not.toContain('md-cols')
    expect(html).toContain('a medio escribir')
  })

  test('keeps every word when a row is nested inside a column', () => {
    const html = renderMarkdownToHtml(
      lines('::: columnas', ':: col', '::: columnas', ':: col', 'anidado', ':::', ':: col', 'fuera', ':::'),
    )

    expect(html).toContain('anidado')
    expect(html).toContain('fuera')
  })

  test('leaves documents without any row exactly as they were', () => {
    const before = renderMarkdownToHtml('# Hola\n\n- uno\n- dos\n')
    expect(before).toContain('<h1>Hola</h1>')
    expect(before).not.toContain('md-cols')
  })
})
