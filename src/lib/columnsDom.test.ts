import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { buildRowHtml } from './columns'
import {
  addColumn,
  blockOf,
  dropBeside,
  removeImageBlock,
  columnsOfRow,
  equalizeWidths,
  insertColumnAt,
  readWidths,
  removeColumn,
  setRowAlign,
  unwrapRow,
  wrapSideBySide,
} from './columnsDom'

let host: HTMLElement

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
})

// Leaving hosts behind lets ids repeat across the document, and an `#id`
// lookup then resolves against an earlier test's leftovers instead of this
// test's DOM.
afterEach(() => host.remove())

function makeRow(...columns: { widthPercent: number | null; html?: string }[]): HTMLElement {
  host.innerHTML = buildRowHtml(columns)
  return host.querySelector<HTMLElement>('.md-cols')!
}

describe('addColumn', () => {
  test('adds an empty column and rebalances the row', () => {
    const row = makeRow({ widthPercent: 60, html: '<p>a</p>' }, { widthPercent: 40, html: '<p>b</p>' })

    addColumn(row)

    expect(columnsOfRow(row)).toHaveLength(3)
    expect(readWidths(row).reduce((x, y) => x + y, 0)).toBe(100)
    expect(row.textContent).toContain('a')
    expect(row.textContent).toContain('b')
  })
})

describe('removeColumn', () => {
  test('drops the column and gives its width back to the rest', () => {
    const row = makeRow(
      { widthPercent: 50, html: '<p>a</p>' },
      { widthPercent: 30, html: '<p>b</p>' },
      { widthPercent: 20, html: '<p>c</p>' },
    )

    removeColumn(row, 2)

    expect(columnsOfRow(row)).toHaveLength(2)
    expect(readWidths(row).reduce((x, y) => x + y, 0)).toBe(100)
  })

  test('moves the content of the removed column into its neighbour instead of deleting it', () => {
    const row = makeRow({ widthPercent: 50, html: '<p>a</p>' }, { widthPercent: 50, html: '<p>importante</p>' })

    removeColumn(row, 1)

    expect(columnsOfRow(row)).toHaveLength(1)
    expect(row.textContent).toContain('a')
    expect(row.textContent).toContain('importante')
  })

  test('the first column falls back to the one after it', () => {
    const row = makeRow({ widthPercent: 50, html: '<p>primera</p>' }, { widthPercent: 50, html: '<p>b</p>' })

    removeColumn(row, 0)

    expect(row.textContent).toContain('primera')
    expect(row.textContent).toContain('b')
  })
})

describe('equalizeWidths', () => {
  test('levels a lopsided row', () => {
    const row = makeRow({ widthPercent: 80, html: '<p>a</p>' }, { widthPercent: 20, html: '<p>b</p>' })

    equalizeWidths(row)

    expect(readWidths(row)).toEqual([50, 50])
  })
})

describe('setRowAlign', () => {
  test('records the vertical alignment on the row', () => {
    const row = makeRow({ widthPercent: 50 }, { widthPercent: 50 })

    setRowAlign(row, 'centro')

    expect(row.getAttribute('data-align')).toBe('centro')
  })
})

describe('unwrapRow', () => {
  test('leaves every block behind, in order, with the row gone', () => {
    const row = makeRow(
      { widthPercent: 50, html: '<p>uno</p><p>dos</p>' },
      { widthPercent: 50, html: '<p>tres</p>' },
    )

    unwrapRow(row)

    expect(host.querySelector('.md-cols')).toBeNull()
    expect(Array.from(host.querySelectorAll('p')).map((p) => p.textContent)).toEqual(['uno', 'dos', 'tres'])
  })
})

describe('insertColumnAt', () => {
  test('puts the new column exactly where asked', () => {
    const row = makeRow({ widthPercent: 50, html: '<p>a</p>' }, { widthPercent: 50, html: '<p>c</p>' })

    insertColumnAt(row, 1, '<p>b</p>')

    expect(columnsOfRow(row).map((c) => c.textContent)).toEqual(['a', 'b', 'c'])
    expect(readWidths(row).reduce((x, y) => x + y, 0)).toBe(100)
  })

  test('appends when the index is past the end', () => {
    const row = makeRow({ widthPercent: 50, html: '<p>a</p>' }, { widthPercent: 50, html: '<p>b</p>' })

    insertColumnAt(row, 9, '<p>z</p>')

    expect(columnsOfRow(row).map((c) => c.textContent)).toEqual(['a', 'b', 'z'])
  })
})

describe('wrapSideBySide', () => {
  test('turns a lone block into a two-column row with the newcomer on the right', () => {
    host.innerHTML = '<p>antes</p><p id="target">objetivo</p><p>despues</p>'
    const target = host.querySelector<HTMLElement>('#target')!

    wrapSideBySide(target, '<p>nuevo</p>', 'right')

    const row = host.querySelector<HTMLElement>('.md-cols')!
    expect(columnsOfRow(row).map((c) => c.textContent)).toEqual(['objetivo', 'nuevo'])
    expect(readWidths(row)).toEqual([50, 50])
  })

  test('puts the newcomer on the left when dropped on that side', () => {
    host.innerHTML = '<p id="target">objetivo</p>'
    const target = host.querySelector<HTMLElement>('#target')!

    wrapSideBySide(target, '<p>nuevo</p>', 'left')

    const row = host.querySelector<HTMLElement>('.md-cols')!
    expect(columnsOfRow(row).map((c) => c.textContent)).toEqual(['nuevo', 'objetivo'])
  })

  test('leaves the surrounding blocks where they were', () => {
    host.innerHTML = '<p>antes</p><p id="target">objetivo</p><p>despues</p>'
    const target = host.querySelector<HTMLElement>('#target')!

    wrapSideBySide(target, '<p>nuevo</p>', 'right')

    expect(host.firstElementChild?.textContent).toBe('antes')
    expect(host.lastElementChild?.textContent).toBe('despues')
  })
})

describe('blockOf', () => {
  test('finds the paragraph wrapping an image, not the image itself', () => {
    host.innerHTML = '<p><img src="a.png"></p>'
    const img = host.querySelector('img')!

    expect(blockOf(img, host).tagName).toBe('P')
  })

  test('stops at the column when the image is already inside a row', () => {
    host.innerHTML = buildRowHtml([{ widthPercent: 50, html: '<p><img src="a.png"></p>' }, { widthPercent: 50 }])
    const img = host.querySelector('img')!

    expect(blockOf(img, host).tagName).toBe('P')
    expect(blockOf(img, host).parentElement?.classList.contains('md-col')).toBe(true)
  })
})

describe('dropBeside', () => {
  test('pairs a standalone image with the newcomer in a fresh row', () => {
    host.innerHTML = '<p><img src="a.png"></p>'
    const img = host.querySelector<HTMLImageElement>('img')!

    dropBeside({ img, side: 'right' }, '<p><img src="b.png"></p>', host)

    const row = host.querySelector<HTMLElement>('.md-cols')!
    const columns = columnsOfRow(row)
    expect(columns).toHaveLength(2)
    expect(columns[0].querySelector('img')?.getAttribute('src')).toBe('a.png')
    expect(columns[1].querySelector('img')?.getAttribute('src')).toBe('b.png')
  })

  test('adds a column to the row when the image is already in one', () => {
    host.innerHTML = buildRowHtml([
      { widthPercent: 50, html: '<p><img src="a.png"></p>' },
      { widthPercent: 50, html: '<p>otra</p>' },
    ])
    const img = host.querySelector<HTMLImageElement>('img')!

    dropBeside({ img, side: 'right' }, '<p><img src="b.png"></p>', host)

    const columns = columnsOfRow(host.querySelector<HTMLElement>('.md-cols')!)
    expect(columns).toHaveLength(3)
    expect(columns[1].querySelector('img')?.getAttribute('src')).toBe('b.png')
    expect(columns[2].textContent).toBe('otra')
  })

  test('drops to the left of the column it was aimed at', () => {
    host.innerHTML = buildRowHtml([
      { widthPercent: 50, html: '<p>primera</p>' },
      { widthPercent: 50, html: '<p><img src="a.png"></p>' },
    ])
    const img = host.querySelector<HTMLImageElement>('img')!

    dropBeside({ img, side: 'left' }, '<p><img src="b.png"></p>', host)

    const columns = columnsOfRow(host.querySelector<HTMLElement>('.md-cols')!)
    expect(columns.map((c) => c.textContent?.trim())).toEqual(['primera', '', ''])
    expect(columns[1].querySelector('img')?.getAttribute('src')).toBe('b.png')
    expect(columns[2].querySelector('img')?.getAttribute('src')).toBe('a.png')
  })
})

describe('removeImageBlock', () => {
  test('takes the empty paragraph away with the image it held', () => {
    host.innerHTML = '<p>antes</p><p><img src="a.png"></p>'
    const img = host.querySelector<HTMLImageElement>('img')!

    removeImageBlock(img, host)

    expect(host.querySelectorAll('p')).toHaveLength(1)
    expect(host.textContent).toBe('antes')
  })

  test('leaves the paragraph alone when it still holds text', () => {
    host.innerHTML = '<p>texto <img src="a.png"> mas texto</p>'
    const img = host.querySelector<HTMLImageElement>('img')!

    removeImageBlock(img, host)

    expect(host.querySelectorAll('p')).toHaveLength(1)
    expect(host.querySelector('img')).toBeNull()
    expect(host.textContent).toContain('mas texto')
  })
})
