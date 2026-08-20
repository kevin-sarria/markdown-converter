import { useEffect, useRef, type KeyboardEvent } from 'react'

interface EditableTextProps {
  as: 'h1' | 'p'
  value: string
  placeholder: string
  className?: string
  onChange: (value: string) => void
}

const SYNC_DEBOUNCE_MS = 400

/**
 * A single-line contentEditable field (used for the cover page's title/
 * subtitle in PreviewPane.tsx) that behaves like a text input rather than a
 * rich-text area: Enter confirms instead of inserting a line break.
 *
 * Same cursor-preservation approach as the main document editor in
 * PreviewPane.tsx: content is written imperatively, and skipNextSyncRef tells
 * the sync effect to leave the DOM alone right after this component itself
 * pushed a change — otherwise every keystroke would reset the caret to the
 * start once the value comes back down as a prop.
 */
export default function EditableText({ as: Tag, value, placeholder, className, onChange }: EditableTextProps) {
  const elRef = useRef<HTMLHeadingElement | HTMLParagraphElement>(null)
  const skipNextSyncRef = useRef(false)
  const debounceRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const el = elRef.current
    if (!el) return
    if (skipNextSyncRef.current) {
      skipNextSyncRef.current = false
      return
    }
    if (el.textContent !== value) el.textContent = value
  }, [value])

  const sync = () => {
    const el = elRef.current
    if (!el) return
    const text = el.textContent ?? ''
    if (text === value) return
    skipNextSyncRef.current = true
    onChange(text)
  }

  const handleInput = () => {
    window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(sync, SYNC_DEBOUNCE_MS)
  }

  const handleBlur = () => {
    window.clearTimeout(debounceRef.current)
    sync()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      elRef.current?.blur()
    }
  }

  return (
    <Tag
      ref={elRef}
      className={className}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onInput={handleInput}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  )
}
