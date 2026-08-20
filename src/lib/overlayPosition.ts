/**
 * The editing chrome (row menu, column dividers, drop guide) is drawn as
 * absolutely-positioned siblings of the page rather than inside it, so nothing
 * decorative ends up in the exported document.
 *
 * That means converting a live element's viewport rect into coordinates of the
 * scrolling preview container. The container's own scroll has to be added back
 * in, and the page is often visually scaled down to fit narrow screens (see
 * PreviewPane) — getBoundingClientRect already reflects that scale, and so does
 * the chrome positioned from it, which is exactly what keeps the two aligned.
 */
export interface OverlayRect {
  top: number
  left: number
  width: number
  height: number
  right: number
  bottom: number
}

export function rectInContainer(element: Element, container: HTMLElement): OverlayRect {
  const rect = element.getBoundingClientRect()
  const host = container.getBoundingClientRect()
  const top = rect.top - host.top + container.scrollTop
  const left = rect.left - host.left + container.scrollLeft

  return {
    top,
    left,
    width: rect.width,
    height: rect.height,
    right: left + rect.width,
    bottom: top + rect.height,
  }
}
