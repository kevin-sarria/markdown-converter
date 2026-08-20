import { useCallback, useEffect, useState } from 'react'
import type { ImageSelection } from '../components/ImageResizeHandle'

const SELECTED_CLASS = 'md-image-selected'

export interface ImageSelectionController {
  selection: ImageSelection | null
  /** Selects the image if `target` is one, otherwise clears the selection. */
  selectFrom: (target: HTMLElement, syncNow: () => void) => void
  clear: () => void
}

/**
 * Which image is selected, so the resize handle knows what to attach to.
 *
 * Pulled out of PreviewPane, which now composes several independent editing
 * behaviours (image selection, row selection, side drops) and would otherwise
 * hold all their state and effects in one body.
 */
export function useImageSelection(): ImageSelectionController {
  const [selection, setSelection] = useState<ImageSelection | null>(null)

  useEffect(() => {
    return () => selection?.img.classList.remove(SELECTED_CLASS)
  }, [selection])

  const clear = useCallback(() => {
    setSelection((previous) => {
      previous?.img.classList.remove(SELECTED_CLASS)
      return null
    })
  }, [])

  const selectFrom = useCallback((target: HTMLElement, syncNow: () => void) => {
    setSelection((previous) => {
      previous?.img.classList.remove(SELECTED_CLASS)
      if (target.tagName !== 'IMG') return null

      const img = target as HTMLImageElement
      img.classList.add(SELECTED_CLASS)
      return { img, syncNow }
    })
  }, [])

  return { selection, selectFrom, clear }
}
