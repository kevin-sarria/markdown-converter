import { describe, expect, test } from 'vitest'
import { htmlToMarkdown } from './htmlToMarkdown'
import { renderMarkdownToHtml } from './markdown'

describe('saving a color span back to Markdown', () => {
  test('a span with an inline rgb() style', () => {
    const html = '<p>normal <span style="color: rgb(11, 42, 107)">azul</span> normal</p>'
    expect(htmlToMarkdown(html)).toContain('[azul]{color=#0b2a6b}')
  })

  test('a legacy <font color> tag', () => {
    const html = '<p>normal <font color="#0b2a6b">azul</font> normal</p>'
    expect(htmlToMarkdown(html)).toContain('[azul]{color=#0b2a6b}')
  })

  test('a plain span with no color is left alone', () => {
    const html = '<p><span>sin color</span></p>'
    expect(htmlToMarkdown(html)).toBe('sin color')
  })
})

const roundTrip = (markdown: string) => htmlToMarkdown(renderMarkdownToHtml(markdown))

describe('a color span', () => {
  test('renders as a span with that color', () => {
    const html = renderMarkdownToHtml('normal [texto en azul]{color=#0b2a6b} normal')
    expect(html).toContain('<span style="color: #0b2a6b">texto en azul</span>')
  })

  test('keeps parsing markdown inside the span', () => {
    const html = renderMarkdownToHtml('[**negrita en azul**]{color=#0b2a6b}')
    expect(html).toContain('<strong>negrita en azul</strong>')
    expect(html).toContain('color: #0b2a6b')
  })

  test('does not swallow a real link', () => {
    const html = renderMarkdownToHtml('[un enlace](https://example.com)')
    expect(html).toContain('<a href="https://example.com"')
    expect(html).not.toContain('color:')
  })

  test('ignores an invalid color and leaves the brackets as text', () => {
    const html = renderMarkdownToHtml('[texto]{color=rojo}')
    expect(html).not.toContain('<span')
    expect(html).toContain('{color=rojo}')
  })

  test('survives the Markdown round trip', () => {
    const back = roundTrip('normal [texto en azul]{color=#0b2a6b} normal')
    expect(back).toContain('[texto en azul]{color=#0b2a6b}')
  })
})
