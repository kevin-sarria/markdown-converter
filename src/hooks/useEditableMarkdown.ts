import { useCallback, useEffect, useMemo, useRef } from 'react'
import { htmlToMarkdown } from '../lib/htmlToMarkdown'
import { renderMarkdownToHtml } from '../lib/markdown'

const SYNC_DEBOUNCE_MS = 400

export interface EditableMarkdownRegion {
  elRef: React.RefObject<HTMLDivElement | null>
  handleInput: () => void
  handleBlur: () => void
  /** Converts the region's current DOM to Markdown right now and pushes it up, bypassing the debounce. */
  syncNow: () => void
}

/**
 * Wires up a contentEditable region so it edits `markdown` WYSIWYG-style,
 * converting back with htmlToMarkdown() on input (debounced) and on blur.
 *
 * Content is written to the DOM imperatively (a useEffect doing
 * `el.innerHTML = ...`) instead of via React's dangerouslySetInnerHTML, so the
 * hook has to tell "this change came from typing right here, the DOM is
 * already correct, don't touch it" from "this change came from somewhere else
 * (the plain-text editor, a file upload, another editable region), re-render
 * the HTML from scratch." Rewriting a focused contentEditable's innerHTML on
 * every keystroke would otherwise reset the cursor to the start.
 *
 * It tells them apart by remembering the markdown it last emitted: an incoming
 * value equal to that is the echo of the edit that just happened here. This
 * used to be a one-shot "skip the next render" flag, which could be armed
 * twice and consumed once — a debounced sync firing late re-sends a value equal
 * to the current markdown, React has nothing to re-render, and the flag stays
 * armed to swallow the next genuine change. Comparing a value can't get out of
 * step that way.
 *
 * Used for both the main document body and the cover page in PreviewPane.tsx
 * — two independent regions, each with their own instance of this hook.
 */
export function useEditableMarkdown(markdown: string, onChange: (markdown: string) => void): EditableMarkdownRegion {
  const elRef = useRef<HTMLDivElement>(null)
  const lastEmittedRef = useRef<string | null>(null)
  const debounceRef = useRef<number | undefined>(undefined)

  const html = useMemo(() => renderMarkdownToHtml(markdown), [markdown])

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    // Our own edit coming back around: the DOM already holds it, and rewriting
    // it would throw away the caret.
    if (markdown === lastEmittedRef.current) return
    el.innerHTML = html
  }, [html, markdown])

  const syncNow = useCallback(() => {
    const el = elRef.current
    if (!el) return
    const newMarkdown = htmlToMarkdown(el.innerHTML)
    if (newMarkdown === markdown) return
    lastEmittedRef.current = newMarkdown
    onChange(newMarkdown)
  }, [markdown, onChange])

  const handleInput = useCallback(() => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(syncNow, SYNC_DEBOUNCE_MS)
  }, [syncNow])

  const handleBlur = useCallback(() => {
    window.clearTimeout(debounceRef.current)
    syncNow()
  }, [syncNow])

  return { elRef, handleInput, handleBlur, syncNow }
}
