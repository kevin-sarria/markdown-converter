import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { useEditableMarkdown, type EditableMarkdownRegion } from './useEditableMarkdown'

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

/** The live region and a setter for markdown "coming from somewhere else". */
let region: EditableMarkdownRegion
let setExternalMarkdown: (markdown: string) => void

/* eslint-disable react/globals, react/refs -- A test has to reach the hook's
   return value and the state setter from outside, which means letting them
   escape the component. That is the harness, not a pattern for real code. */
function Harness({ initial }: { initial: string }) {
  const [markdown, setMarkdown] = useState(initial)
  setExternalMarkdown = setMarkdown
  region = useEditableMarkdown(markdown, setMarkdown)
  return <div ref={region.elRef} contentEditable suppressContentEditableWarning />
}
/* eslint-enable react/globals, react/refs */

function mount(initial: string) {
  act(() => {
    root.render(<Harness initial={initial} />)
  })
}

const previewHtml = () => container.querySelector('[contenteditable]')!.innerHTML.trim()

/** Simulates the user typing in the preview: the DOM changes, then it syncs. */
function editPreview(html: string) {
  act(() => {
    region.elRef.current!.innerHTML = html
  })
}

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

describe('editing in the preview', () => {
  test('renders the markdown it is given', () => {
    mount('# Hola')
    expect(previewHtml()).toBe('<h1>Hola</h1>')
  })

  test('does not rewrite the DOM after an edit made right here', () => {
    mount('hola')
    // A contentEditable's own markup is not what the renderer would produce for
    // the same text; rewriting it would move the caret on every keystroke.
    editPreview('<p>hola mundo<br></p>')
    act(() => region.syncNow())

    expect(previewHtml()).toBe('<p>hola mundo<br></p>')
  })

  test('picks up markdown that changed somewhere else', () => {
    mount('hola')
    act(() => setExternalMarkdown('# Otro documento'))

    expect(previewHtml()).toBe('<h1>Otro documento</h1>')
  })

  test('still picks it up after a stale sync re-sent the current markdown', () => {
    mount('hola')

    // Captured now, while the hook still thinks the document says "hola" —
    // exactly what a debounced sync holds after it has been scheduled.
    const staleSync = region.syncNow

    editPreview('<p>editado</p>')
    act(() => staleSync())

    // The debounce fires late, after the edit already landed. It compares the
    // document against the markdown of its own moment, finds a difference, and
    // re-sends a value equal to the current one — so React has nothing to
    // re-render. Anything the hook armed for "ignore the next render" is then
    // still armed, waiting to swallow a real update.
    act(() => staleSync())

    act(() => setExternalMarkdown('# Documento nuevo'))
    expect(previewHtml()).toBe('<h1>Documento nuevo</h1>')
  })
})
