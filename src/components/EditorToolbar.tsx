import { useRef, type ReactNode, type RefObject } from 'react'
import { fileToDataUrl } from '../lib/headerFooter'

interface EditorToolbarProps {
  /** The contentEditable node the toolbar acts on (see PreviewPane.tsx). */
  editableRef: RefObject<HTMLDivElement | null>
  /** Called after a command runs, so the caller can re-sync Markdown from the edited DOM. */
  onEdited: () => void
}

const PAGE_BREAK_HTML =
  '<div class="page-break" data-page-break contenteditable="false"><span class="page-break-label">Salto de página</span></div><p><br></p>'

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-medium text-white/70 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  )
}

/**
 * A minimal Word-style formatting toolbar for the editable preview. Uses
 * `document.execCommand` — deprecated, but still supported everywhere, and for
 * this small, fixed set of operations (bold/italic/headings/lists/links/images)
 * it's far less code than reimplementing Selection/Range manipulation by hand.
 * If it's ever actually removed from browsers, that's the place to revisit.
 */
export default function EditorToolbar({ editableRef, onEdited }: EditorToolbarProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  // Opening the native file picker always blurs the page, wiping the current
  // selection — save it on click so the image can still land at the cursor the
  // user actually had, instead of wherever focus happens to end up afterwards.
  const savedRangeRef = useRef<Range | null>(null)

  const focusEditable = () => editableRef.current?.focus()

  const exec = (command: string, value?: string) => {
    focusEditable()
    document.execCommand(command, false, value)
    onEdited()
  }

  const handleImageButtonClick = () => {
    const selection = window.getSelection()
    savedRangeRef.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
    imageInputRef.current?.click()
  }

  const handleInsertImage = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    focusEditable()
    const selection = window.getSelection()
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges()
      selection.addRange(savedRangeRef.current)
    }
    document.execCommand('insertImage', false, dataUrl)
    onEdited()
  }

  const handleLink = () => {
    const url = window.prompt('URL del enlace:')
    if (!url) return
    exec('createLink', url)
  }

  return (
    <div
      className="flex flex-wrap items-center gap-0.5 border-b border-white/5 bg-[#111219] px-2 py-1"
      // Keeps the current text selection alive when a button is pressed —
      // without this, clicking a button blurs the editor first and execCommand
      // has nothing to act on.
      onMouseDown={(e) => e.preventDefault()}
    >
      <ToolbarButton title="Negrita" onClick={() => exec('bold')}>
        <b>N</b>
      </ToolbarButton>
      <ToolbarButton title="Cursiva" onClick={() => exec('italic')}>
        <i>K</i>
      </ToolbarButton>
      <ToolbarButton title="Tachado" onClick={() => exec('strikeThrough')}>
        <s>S</s>
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton title="Título 1" onClick={() => exec('formatBlock', '<h1>')}>
        H1
      </ToolbarButton>
      <ToolbarButton title="Título 2" onClick={() => exec('formatBlock', '<h2>')}>
        H2
      </ToolbarButton>
      <ToolbarButton title="Título 3" onClick={() => exec('formatBlock', '<h3>')}>
        H3
      </ToolbarButton>
      <ToolbarButton title="Párrafo normal" onClick={() => exec('formatBlock', '<p>')}>
        P
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton title="Lista con viñetas" onClick={() => exec('insertUnorderedList')}>
        •—
      </ToolbarButton>
      <ToolbarButton title="Lista numerada" onClick={() => exec('insertOrderedList')}>
        1.—
      </ToolbarButton>
      <ToolbarButton title="Cita" onClick={() => exec('formatBlock', '<blockquote>')}>
        “ ”
      </ToolbarButton>

      <div className="mx-1 h-5 w-px bg-white/10" />

      <ToolbarButton title="Insertar enlace" onClick={handleLink}>
        🔗
      </ToolbarButton>
      <ToolbarButton title="Insertar imagen" onClick={handleImageButtonClick}>
        🖼
      </ToolbarButton>
      <ToolbarButton title="Insertar salto de página" onClick={() => exec('insertHTML', PAGE_BREAK_HTML)}>
        ⤓ Salto
      </ToolbarButton>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleInsertImage(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
