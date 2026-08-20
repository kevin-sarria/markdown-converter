import type { CanvasItem } from './canvas'

/**
 * Alignment snapping while dragging on a canvas page.
 *
 * This is the difference between a layout tool and a frustrating one. Nobody
 * can centre a logo by eye at 1% precision, and two logos that are two tenths
 * of a percent out of line look wrong without looking obviously wrong. Snapping
 * makes "centred" and "aligned with that one" reachable by hand, and the guides
 * say which of the two just happened.
 *
 * Kept pure — boxes in, box and guides out — so the geometry can be tested
 * without a pointer.
 */

export interface SnapGuide {
  axis: 'x' | 'y'
  /** Where to draw the line, in percent of the page. */
  at: number
}

export interface SnapResult {
  item: CanvasItem
  guides: SnapGuide[]
}

/** How close, in percent of the page, counts as "meant to line up". */
export const SNAP_THRESHOLD_PERCENT = 0.8

export function snapItem(
  item: CanvasItem,
  others: CanvasItem[],
  threshold = SNAP_THRESHOLD_PERCENT,
): SnapResult {
  const guides: SnapGuide[] = []

  const x = snapAxis(item.x, item.w, others.map((o) => ({ start: o.x, size: o.w })), threshold)
  const y = snapAxis(item.y, item.h ?? 0, others.map((o) => ({ start: o.y, size: o.h ?? 0 })), threshold)

  if (x) guides.push({ axis: 'x', at: x.guideAt })
  if (y) guides.push({ axis: 'y', at: y.guideAt })

  return {
    item: { ...item, x: x ? x.start : item.x, y: y ? y.start : item.y },
    guides,
  }
}

interface Span {
  start: number
  size: number
}

/**
 * Snaps one axis. Both the moving box's three interesting lines (leading edge,
 * centre, trailing edge) and every target line are compared, and the single
 * closest pairing within the threshold wins — so a box near both the page
 * centre and a neighbour's edge goes to whichever it is actually nearer,
 * instead of to whichever happened to be checked first.
 */
function snapAxis(
  start: number,
  size: number,
  others: Span[],
  threshold: number,
): { start: number; guideAt: number } | null {
  const targets = [0, 50, 100]
  for (const other of others) {
    targets.push(other.start, other.start + other.size / 2, other.start + other.size)
  }

  // Where each of the moving box's lines currently sits, and what `start` would
  // have to become for that line to land on a target.
  const lines = [
    { at: start, toStart: (target: number) => target },
    { at: start + size / 2, toStart: (target: number) => target - size / 2 },
    { at: start + size, toStart: (target: number) => target - size },
  ]

  let best: { distance: number; start: number; guideAt: number } | null = null

  for (const line of lines) {
    for (const target of targets) {
      const distance = Math.abs(line.at - target)
      if (distance > threshold) continue
      if (best && distance >= best.distance) continue
      best = { distance, start: round(line.toStart(target)), guideAt: target }
    }
  }

  return best ? { start: best.start, guideAt: best.guideAt } : null
}

/** Matches the one-decimal precision the document is written with (canvas.ts). */
function round(value: number): number {
  return Math.round(value * 10) / 10
}
