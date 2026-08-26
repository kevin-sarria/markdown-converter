import { describe, expect, test } from 'vitest'
import { rgbToHex } from './color'

describe('rgbToHex', () => {
  test('converts an rgb() triplet to hex', () => {
    expect(rgbToHex('rgb(11, 42, 107)')).toBe('#0b2a6b')
  })

  test('passes an already-hex value through unchanged', () => {
    expect(rgbToHex('#0B2A6B')).toBe('#0B2A6B')
  })

  test('pads single-digit channels', () => {
    expect(rgbToHex('rgb(0, 5, 255)')).toBe('#0005ff')
  })

  test('returns null for anything else', () => {
    expect(rgbToHex('')).toBeNull()
    expect(rgbToHex('transparent')).toBeNull()
    expect(rgbToHex('rgba(0, 0, 0, 0.5)')).toBeNull()
  })
})
