import { useCallback, useEffect, useState } from 'react'
import {
  addColumn,
  columnsOfRow,
  deleteRow,
  equalizeWidths,
  removeColumn,
  setRowAlign,
  unwrapRow,
} from '../lib/columnsDom'
import type { ColumnAlign } from '../lib/columns'

const SELECTED_CLASS = 'md-cols-selected'

export interface RowSelection {
  row: HTMLElement
  /** Pushes the edited DOM back into Markdown — the region's syncNow. */
  syncNow: () => void
}

export interface ColumnsRowController {
  selection: RowSelection | null
  select: (selection: RowSelection | null) => void
  addColumn: () => void
  removeLastColumn: () => void
  equalize: () => void
  setAlign: (align: ColumnAlign) => void
  /** Dissolves the row, leaving its content stacked in the document. */
  unwrap: () => void
  /** Removes the row and everything in it. */
  remove: () => void
}

/**
 * Tracks which columns row the user has selected and applies edits to it.
 *
 * There is no React copy of the row's structure: every action mutates the DOM
 * through columnsDom and then calls the region's syncNow(), which converts the
 * edited DOM back to Markdown. Markdown remains the single source of truth, and
 * the DOM is the working draft on its way there — the same contract the rest of
 * the editable preview already follows.
 */
export function useColumnsRow(): ColumnsRowController {
  const [selection, setSelection] = useState<RowSelection | null>(null)

  const select = useCallback((next: RowSelection | null) => {
    setSelection((previous) => {
      previous?.row.classList.remove(SELECTED_CLASS)
      next?.row.classList.add(SELECTED_CLASS)
      return next
    })
  }, [])

  // A change coming from anywhere else — the plain-text editor, a file upload,
  // switching documents — re-renders the preview's HTML from scratch, which
  // leaves this row detached and its menu floating over nothing. The DOM is the
  // external system here, so watch it directly rather than re-checking on every
  // render.
  useEffect(() => {
    if (!selection) return

    const region = selection.row.closest('.md-preview') ?? document.body
    const observer = new MutationObserver(() => {
      if (!document.contains(selection.row)) setSelection(null)
    })
    observer.observe(region, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [selection])

  const apply = useCallback(
    (mutate: (row: HTMLElement) => void, keepSelection = true) => {
      if (!selection) return
      mutate(selection.row)
      selection.syncNow()
      if (!keepSelection) setSelection(null)
    },
    [selection],
  )

  return {
    selection,
    select,
    addColumn: useCallback(() => apply((row) => addColumn(row)), [apply]),
    removeLastColumn: useCallback(
      () => apply((row) => removeColumn(row, columnsOfRow(row).length - 1)),
      [apply],
    ),
    equalize: useCallback(() => apply((row) => equalizeWidths(row)), [apply]),
    setAlign: useCallback((align: ColumnAlign) => apply((row) => setRowAlign(row, align)), [apply]),
    unwrap: useCallback(() => apply((row) => unwrapRow(row), false), [apply]),
    remove: useCallback(() => apply((row) => deleteRow(row), false), [apply]),
  }
}
