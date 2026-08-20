import { describe, expect, test } from 'vitest'
import { snapItem } from './canvasSnap'
import type { CanvasBox } from './canvas'

const box = (x: number, y: number, w = 20, h: number | null = 10): CanvasBox => ({ x, y, w, h })

describe('snapItem', () => {
  test('leaves a box alone when nothing is near', () => {
    const item = box(13, 27)
    expect(snapItem(item, []).item).toEqual(item)
  })

  test('pulls a nearly-centred box onto the centre of the page', () => {
    // Centring a logo by eye is the single most common thing on a cover.
    const { item, guides } = snapItem(box(39.6, 20), [])

    expect(item.x).toBe(40) // 40 + 20/2 === 50, dead centre
    expect(guides).toContainEqual({ axis: 'x', at: 50 })
  })

  test('snaps to the page edges', () => {
    expect(snapItem(box(0.4, 50), []).item.x).toBe(0)
    expect(snapItem(box(79.5, 50), []).item.x).toBe(80) // right edge: 80 + 20 === 100
  })

  test('lines a box up with the left edge of another', () => {
    const other = box(30, 10)
    expect(snapItem(box(30.5, 40), [other]).item.x).toBe(30)
  })

  test('lines two boxes up by their centres', () => {
    const other = box(30, 10, 40)
    // other's centre is 50; a 20-wide box centres there at x=40.
    expect(snapItem(box(40.4, 60), [other]).item.x).toBe(40)
  })

  test('lines a box up with the top of another, on the other axis', () => {
    const other = box(70, 25)
    const { item, guides } = snapItem(box(10, 25.4), [other])

    expect(item.y).toBe(25)
    expect(guides).toContainEqual({ axis: 'y', at: 25 })
  })

  test('does not snap to something too far away', () => {
    expect(snapItem(box(35, 40), [box(30, 10)]).item.x).toBe(35)
  })

  test('takes the nearest target when several are in range', () => {
    // Page centre wants x=40; another box's left edge wants x=39.7.
    expect(snapItem(box(39.75, 60), [box(39.7, 10)]).item.x).toBe(39.7)
  })

  test('keeps the size untouched — snapping moves, it never resizes', () => {
    const { item } = snapItem(box(39.6, 20, 20, 10), [])
    expect(item.w).toBe(20)
    expect(item.h).toBe(10)
  })

  test('reports no guides when nothing snapped', () => {
    expect(snapItem(box(13, 27), []).guides).toEqual([])
  })
})
