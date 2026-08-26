import { useCallback, useEffect, useState } from 'react'
import { rgbToHex } from '../lib/color'

export interface TextFormatState {
  bold: boolean
  italic: boolean
  strike: boolean
  list: 'bullet' | 'number' | null
  color: string | null
}

const EMPTY_STATE: TextFormatState = { bold: false, italic: false, strike: false, list: null, color: null }

/**
 * What formatting is active at the current selection, read straight from the
 * browser rather than tracked by hand — `document.queryCommandState` is the
 * same API `document.execCommand` already answers to (see EditorToolbar.tsx),
 * so this can never drift from what a command would actually do.
 *
 * The main toolbar and the canvas item's floating toolbar each call this
 * independently. That is what makes them "the same bar" without a shared
 * store: both ask the one source of truth the browser already keeps.
 *
 * `refresh` exists because not every execCommand reliably fires
 * `selectionchange` in every browser — callers call it themselves right after
 * their own `document.execCommand(...)`, in addition to the automatic
 * listener below.
 */
export function useTextFormatState(): { format: TextFormatState; refresh: () => void } {
  const [format, setFormat] = useState<TextFormatState>(EMPTY_STATE)

  const refresh = useCallback(() => {
    try {
      setFormat({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        strike: document.queryCommandState('strikeThrough'),
        list: document.queryCommandState('insertUnorderedList')
          ? 'bullet'
          : document.queryCommandState('insertOrderedList')
            ? 'number'
            : null,
        color: rgbToHex(document.queryCommandValue('foreColor')),
      })
    } catch {
      setFormat(EMPTY_STATE)
    }
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', refresh)
    return () => document.removeEventListener('selectionchange', refresh)
  }, [refresh])

  return { format, refresh }
}
