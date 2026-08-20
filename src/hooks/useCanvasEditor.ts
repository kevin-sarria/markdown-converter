import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import {
  NO_STYLE,
  readItem,
  writeItem,
  writeItemStyle,
  type CanvasItem,
  type CanvasItemStyle,
} from '../lib/canvas'
import { addItem, canvasOf, itemOf, siblingBoxes } from '../lib/canvasDom'
import { snapItem, type SnapGuide } from '../lib/canvasSnap'

/** How far an arrow key nudges a selected item, in percent of the page. */
const NUDGE_PERCENT = 0.5
const NUDGE_COARSE_PERCENT = 2

export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se'

export interface CanvasSelection {
  item: HTMLElement
  canvas: HTMLElement
  /** Pushes the edited DOM back into Markdown — the region's syncNow. */
  syncNow: () => void
}

export interface CanvasPageSelection {
  canvas: HTMLElement
  syncNow: () => void
  /** Where on the page the user last clicked, in percent — where a new item lands. */
  at: { x: number; y: number }
}

export interface CanvasEditor {
  selection: CanvasSelection | null
  /** The canvas itself, selected by clicking its empty space. */
  page: CanvasPageSelection | null
  guides: SnapGuide[]
  dragging: boolean
  /** True while the selected item has text editing switched on. */
  editingText: boolean
  select: (selection: CanvasSelection | null) => void
  /** Press on an item: selects it and arms a move. */
  handleItemMouseDown: (e: ReactMouseEvent, selection: CanvasSelection) => void
  /** Press on a corner grip: arms a resize from that corner. */
  handleGripMouseDown: (e: ReactMouseEvent, corner: ResizeCorner) => void
  /** Double click: hands the item over to the caret so its text can be typed. */
  beginTextEditing: () => void
  bringToFront: () => void
  sendToBack: () => void
  remove: () => void
  /** Click on a canvas's empty space: selects the page and remembers where. */
  handlePageMouseDown: (e: ReactMouseEvent, canvas: HTMLElement, syncNow: () => void) => void
  addTextItem: () => void
  addImageItem: (dataUrl: string) => void
  /** The style of the selected box, so the controls can show what it is. */
  style: CanvasItemStyle
  /** Changes part of the selected box's style; null on a field clears it. */
  setStyle: (patch: Partial<CanvasItemStyle>) => void
}

interface DragState {
  kind: 'move' | 'resize'
  corner: ResizeCorner | null
  startX: number
  startY: number
  origin: CanvasItem
  /** The page's on-screen size, to turn pixel deltas into percentages. */
  pageWidth: number
  pageHeight: number
  siblings: CanvasItem[]
}

const SELECTED_CLASS = 'is-selected'
const DRAGGING_CLASS = 'is-dragging'

/**
 * Moving, resizing and text-editing items on a canvas page.
 *
 * Items are inert (`contenteditable` is off — see canvas.ts), so a press on one
 * is unambiguously "grab this box" rather than "put the caret here". That is
 * what makes dragging predictable: nothing is handed to the browser's own
 * contentEditable drag, which decides for itself where a node ends up and can
 * drop it somewhere the content is lost. Typing into an item is a deliberate
 * second gesture — double click — and it is switched off again as soon as the
 * selection moves on.
 *
 * Pixel deltas are divided by the page's own on-screen size, so the same drag
 * means the same thing whether the preview is zoomed to fit a laptop or shown
 * at full size.
 */
export function useCanvasEditor(): CanvasEditor {
  const [selection, setSelection] = useState<CanvasSelection | null>(null)
  const [page, setPage] = useState<CanvasPageSelection | null>(null)
  const [guides, setGuides] = useState<SnapGuide[]>([])
  const [dragging, setDragging] = useState(false)
  const [editingText, setEditingText] = useState(false)
  const dragRef = useRef<DragState | null>(null)
  /** Ends the drag in progress and detaches its listeners, if there is one. */
  const releaseRef = useRef<(() => void) | null>(null)

  const stopTextEditing = useCallback((item: HTMLElement | undefined) => {
    item?.removeAttribute('contenteditable')
  }, [])

  const select = useCallback(
    (next: CanvasSelection | null) => {
      setSelection((previous) => {
        if (previous?.item === next?.item) return previous
        previous?.item.classList.remove(SELECTED_CLASS)
        stopTextEditing(previous?.item)
        next?.item.classList.add(SELECTED_CLASS)
        return next
      })
      setEditingText(false)
      if (next) setPage(null)
    },
    [stopTextEditing],
  )

  // A change from elsewhere re-renders the preview's HTML, leaving this item
  // detached and its grips floating over nothing.
  useEffect(() => {
    if (!selection) return
    const region = selection.canvas.closest('.md-preview') ?? document.body
    const observer = new MutationObserver(() => {
      if (!document.contains(selection.item)) setSelection(null)
    })
    observer.observe(region, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [selection])

  /**
   * Starts a move or a resize, and listens for the rest of it.
   *
   * The listeners go on at this moment rather than from an effect keyed on the
   * selection. An effect only runs after the render that the mousedown causes,
   * which leaves a gap: a mouseup arriving inside that gap is never heard, the
   * drag never ends, and the box stays stuck to the cursor with its toolbar
   * hidden. Arming and listening in the same breath closes it.
   */
  const armDrag = useCallback(
    (e: ReactMouseEvent, kind: DragState['kind'], corner: ResizeCorner | null, target: CanvasSelection) => {
      const rect = target.canvas.getBoundingClientRect()
      dragRef.current = {
        kind,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        origin: readItem(target.item),
        pageWidth: rect.width,
        pageHeight: rect.height,
        siblings: siblingBoxes(target.item),
      }
      setDragging(true)
      target.item.classList.add(DRAGGING_CLASS)

      const handleMouseMove = (move: MouseEvent) => {
        const drag = dragRef.current
        if (!drag) return

        const dx = ((move.clientX - drag.startX) / drag.pageWidth) * 100
        const dy = ((move.clientY - drag.startY) / drag.pageHeight) * 100
        const moved =
          drag.kind === 'move' ? moveBox(drag.origin, dx, dy) : resizeBox(drag.origin, drag.corner!, dx)

        // Resizing shouldn't wander off its own anchor, so only a move snaps.
        const snapped = drag.kind === 'move' ? snapItem(moved, drag.siblings) : { item: moved, guides: [] }
        writeItem(target.item, snapped.item)
        setGuides(snapped.guides)
      }

      const finish = () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', finish)
        releaseRef.current = null

        dragRef.current = null
        setDragging(false)
        setGuides([])
        target.item.classList.remove(DRAGGING_CLASS)
        target.syncNow()
      }

      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', finish)
      releaseRef.current = finish
    },
    [],
  )

  // Unmounting mid-drag would otherwise leave the listeners behind.
  useEffect(() => () => releaseRef.current?.(), [])

  const handleItemMouseDown = useCallback(
    (e: ReactMouseEvent, next: CanvasSelection) => {
      // While typing inside an item, a press belongs to the caret, not to a drag.
      if (editingText && selection?.item === next.item) return
      e.preventDefault()
      select(next)
      armDrag(e, 'move', null, next)
    },
    [armDrag, editingText, select, selection],
  )

  const handleGripMouseDown = useCallback(
    (e: ReactMouseEvent, corner: ResizeCorner) => {
      if (!selection) return
      e.preventDefault()
      armDrag(e, 'resize', corner, selection)
    },
    [armDrag, selection],
  )

  // Arrow keys for the placement a hand can't make.
  useEffect(() => {
    if (!selection || editingText) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? NUDGE_COARSE_PERCENT : NUDGE_PERCENT
      const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[
        e.key
      ]
      if (!delta) return

      e.preventDefault()
      writeItem(selection.item, moveBox(readItem(selection.item), delta[0], delta[1]))
      selection.syncNow()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selection, editingText])

  const act = useCallback(
    (mutate: (item: HTMLElement) => void, keepSelection = true) => {
      if (!selection) return
      mutate(selection.item)
      selection.syncNow()
      if (!keepSelection) select(null)
    },
    [selection, select],
  )

  const handlePageMouseDown = useCallback(
    (e: ReactMouseEvent, canvas: HTMLElement, syncNow: () => void) => {
      const rect = canvas.getBoundingClientRect()
      select(null)
      setPage({
        canvas,
        syncNow,
        at: {
          x: ((e.clientX - rect.left) / rect.width) * 100,
          y: ((e.clientY - rect.top) / rect.height) * 100,
        },
      })
    },
    [select],
  )

  // A new item lands where the click was, not in a fixed corner where it would
  // sit on top of whatever is already there.
  const addAtClick = useCallback(
    (html: string, width: number) => {
      if (!page) return
      addItem(page.canvas, html, { x: page.at.x, y: page.at.y, w: width, h: null, style: { ...NO_STYLE } })
      page.syncNow()
      setPage(null)
    },
    [page],
  )

  return {
    selection,
    page,
    handlePageMouseDown,
    addTextItem: useCallback(() => addAtClick('<p>Texto nuevo</p>', 40), [addAtClick]),
    addImageItem: useCallback((dataUrl: string) => addAtClick(`<p><img src="${dataUrl}"></p>`, 25), [addAtClick]),
    guides,
    dragging,
    editingText,
    select,
    handleItemMouseDown,
    handleGripMouseDown,
    beginTextEditing: useCallback(() => {
      if (!selection) return
      selection.item.setAttribute('contenteditable', 'true')
      selection.item.focus()
      setEditingText(true)
    }, [selection]),
    style: selection ? readItem(selection.item).style : NO_STYLE,
    setStyle: useCallback(
      (patch: Partial<CanvasItemStyle>) =>
        act((item) => writeItemStyle(item, { ...readItem(item).style, ...patch })),
      [act],
    ),
    bringToFront: useCallback(() => act((item) => canvasOf(item)?.appendChild(item)), [act]),
    sendToBack: useCallback(
      () =>
        act((item) => {
          const canvas = canvasOf(item)
          if (canvas) canvas.insertBefore(item, canvas.firstChild)
        }),
      [act],
    ),
    remove: useCallback(() => act((item) => item.remove(), false), [act]),
  }
}

function moveBox(origin: CanvasItem, dx: number, dy: number): CanvasItem {
  return { ...origin, x: origin.x + dx, y: origin.y + dy }
}

/**
 * Corner resize. Only the width changes: images inside an item are drawn at
 * 100% width with automatic height, so a width change scales them
 * proportionally — a logo can't come out stretched. Dragging a west corner also
 * moves the box, so the opposite edge stays put under the cursor.
 */
function resizeBox(origin: CanvasItem, corner: ResizeCorner, dx: number): CanvasItem {
  const west = corner === 'nw' || corner === 'sw'
  const width = west ? origin.w - dx : origin.w + dx
  return { ...origin, w: width, x: west ? origin.x + (origin.w - width) : origin.x }
}

/** Re-exported so the overlay can attach to the same item the editor selected. */
export { itemOf, canvasOf }
