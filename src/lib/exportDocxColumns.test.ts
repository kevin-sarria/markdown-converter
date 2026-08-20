import JSZip from 'jszip'
import { describe, expect, test } from 'vitest'
import { buildDocxBlob } from './exportDocx'
import { DEFAULT_SETTINGS } from './settings'

const lines = (...ls: string[]) => ls.join('\n')

/** The main document part of a generated .docx, as XML text. */
async function documentXml(markdown: string): Promise<string> {
  const blob = await buildDocxBlob(markdown, DEFAULT_SETTINGS)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file('word/document.xml')!.async('text')
}

describe('a columns row in Word', () => {
  const source = lines(
    '::: columnas',
    ':: col 60',
    '### Izquierda',
    '',
    '- uno',
    ':: col 40',
    '> derecha',
    ':::',
  )

  test('becomes a real table, so the columns actually sit side by side', async () => {
    const xml = await documentXml(source)

    expect(xml).toContain('<w:tbl>')
    // One row, two cells.
    expect((xml.match(/<w:tc>/g) ?? []).length).toBe(2)
  })

  test('carries the widths the user chose', async () => {
    const xml = await documentXml(source)

    expect(xml).toContain('60%')
    expect(xml).toContain('40%')
  })

  test('draws no borders, so it reads as layout and not as a grid', async () => {
    const xml = await documentXml(source)

    const borders = xml.slice(xml.indexOf('<w:tblBorders>'), xml.indexOf('</w:tblBorders>'))

    expect(borders).not.toBe('')
    expect(borders).not.toMatch(/w:val="single"/)
    // Every edge, not just the outside ones.
    expect((borders.match(/w:val="none"/g) ?? []).length).toBe(6)
  })

  test('leaves the accent bar of a quote inside a column alone', async () => {
    const xml = await documentXml(source)

    // Borderless refers to the table; the content keeps its own styling.
    expect(xml).toMatch(/<w:pBdr><w:left w:val="single"/)
  })

  test('keeps the heading, the list and the quote inside their columns', async () => {
    const xml = await documentXml(source)

    const table = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>'))
    expect(table).toContain('Izquierda')
    expect(table).toContain('uno')
    expect(table).toContain('derecha')
  })

  test('still writes a bordered table for an actual Markdown table', async () => {
    const xml = await documentXml(lines('| a | b |', '| --- | --- |', '| 1 | 2 |'))

    const table = xml.slice(xml.indexOf('<w:tbl>'), xml.indexOf('</w:tbl>'))
    expect(table).toMatch(/w:val="single"/)
  })
})
