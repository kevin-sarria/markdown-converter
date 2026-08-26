import JSZip from 'jszip'
import { describe, expect, test } from 'vitest'
import { buildDocxBlob } from './exportDocx'
import { DEFAULT_SETTINGS } from './settings'

const lines = (...ls: string[]) => ls.join('\n')

async function documentXml(markdown: string): Promise<string> {
  const blob = await buildDocxBlob(markdown, DEFAULT_SETTINGS)
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  return zip.file('word/document.xml')!.async('text')
}

const CANVAS = lines(
  '::: lienzo',
  ':: en 10,12 30',
  '# Entorno de producción',
  ':: en 60,12 25',
  'Preparado por Algoritmo',
  ':::',
)

describe('a canvas page in Word', () => {
  test('anchors each text block as its own floating shape', async () => {
    const xml = await documentXml(CANVAS)

    // wp:anchor is DrawingML's floating object — the same mechanism a real
    // Word "Insert > Text Box" produces, and the same one already proven to
    // render correctly for floating images in this exporter.
    expect((xml.match(/<wp:anchor/g) ?? []).length).toBe(2)
    expect(xml).toContain('Entorno de producción')
    expect(xml).toContain('Preparado por Algoritmo')
  })

  test('positions are absolute on the page and never wrap with the flow', async () => {
    const xml = await documentXml(CANVAS)

    // relativeFrom="page" appears on both the horizontal and vertical position
    // of each of the two shapes.
    expect((xml.match(/relativeFrom="page"/g) ?? []).length).toBe(4)
    // wrapNone is what makes the shape float independently of surrounding
    // text — nothing reflows around it, ever, regardless of what's nearby.
    expect((xml.match(/<wp:wrapNone\/>/g) ?? []).length).toBe(2)

    // The second block starts further right than the first, as laid out.
    const x = [...xml.matchAll(/<wp:positionH[^>]*><wp:posOffset>([\d.]+)/g)].map((m) => Number(m[1]))
    expect(x).toHaveLength(2)
    expect(x[1]).toBeGreaterThan(x[0])
  })

  test('does not use the old flow-interacting frame mechanism', async () => {
    // w:framePr (legacy Word 6 frames) still participates in text flow — two
    // frames placed a few percent apart, completely normal in a real cover,
    // end up overlapping and Word has to reflow lines to resolve it. That
    // reflow is what looked like "the text moves every time I reopen it".
    const xml = await documentXml(CANVAS)
    expect(xml).not.toContain('<w:framePr')
  })

  test('ends the page, so the next content does not pile on top of it', async () => {
    const xml = await documentXml(`${CANVAS}\n\ndespués`)

    expect(xml).toContain('w:type="page"')
    expect(xml).toContain('después')
  })

  test('leaves a flowing document exactly as it was', async () => {
    const xml = await documentXml('# Título\n\nUn párrafo.')

    expect(xml).not.toContain('<wp:anchor')
    expect(xml).toContain('Título')
  })

  test('does not end the document with a blank page', async () => {
    // A canvas closes its page so the next block starts fresh — but when there
    // is no next block, that break is a blank sheet at the end of the file.
    const xml = await documentXml(CANVAS)
    expect(xml).not.toContain('w:type="page"')
  })
})

describe('the style of a canvas box in Word', () => {
  const STYLED = lines(
    '::: lienzo',
    ':: en 15,48 70 size=26 color=#0b2a6b align=centro',
    'Entorno de producción',
    ':::',
  )

  test('carries the size and the colour the box was given', async () => {
    const xml = await documentXml(STYLED)

    // Word measures type in half-points.
    expect(xml).toContain('<w:sz w:val="52"/>')
    expect(xml).toContain('w:val="0B2A6B"')
  })

  test('carries the alignment', async () => {
    expect(await documentXml(STYLED)).toContain('<w:jc w:val="center"/>')
  })

  test('a box with no style follows the document, as it does on screen', async () => {
    const plain = lines('::: lienzo', ':: en 10,10 30', 'texto', ':::')
    const xml = await documentXml(plain)

    expect(xml).not.toContain('w:val="0B2A6B"')
    expect(xml).toContain('texto')
  })

  test('a word wrapped in a color span overrides the box color just for that word', async () => {
    const xml = await documentXml(
      lines('::: lienzo', ':: en 15,48 70 color=#0b2a6b', 'normal [roja]{color=#ff0000} normal', ':::'),
    )

    expect(xml).toContain('w:val="0B2A6B"')
    expect(xml).toContain('w:val="FF0000"')
  })

  test('a color span inside bold text keeps both', async () => {
    const xml = await documentXml(
      lines('::: lienzo', ':: en 10,10 60', '**[roja]{color=#ff0000} y negrita**', ':::'),
    )

    expect(xml).toContain('<w:b/>')
    expect(xml).toContain('w:val="FF0000"')
  })
})
