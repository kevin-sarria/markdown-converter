import { useRef, type ReactNode } from 'react'
import ColorPicker from './ColorPicker'
import { useTextFormatState } from '../hooks/useTextFormatState'
import type { CanvasEditor } from '../hooks/useCanvasEditor'
import type { ColorTheme } from '../lib/themes'

function FormatButton({
  onClick,
  title,
  pressed,
  children,
}: {
  onClick: () => void
  title: string
  pressed?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`flex h-6 min-w-6 items-center justify-center rounded px-1 text-xs font-medium ${
        pressed ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/**
 * Character-level formatting for the selected canvas item's text, while it is
 * in edit mode — negrita/cursiva/tachado/listas plus a per-word color. Lives
 * next to (not instead of) CanvasStyleBar: that bar is whole-box style
 * (size/color/align/font, see canvas.ts), this one is the words themselves,
 * the same split Markdown itself makes between a box's attributes and bold or
 * italic text.
 *
 * Uses `document.execCommand` exactly like EditorToolbar.tsx — a canvas item
 * in text-edit mode is the same kind of contenteditable island that toolbar
 * already knows how to act on.
 */
export default function CanvasTextFormatBar({ editor, theme }: { editor: CanvasEditor; theme: ColorTheme }) {
  const { format, refresh } = useTextFormatState()
  const savedRangeRef = useRef<Range | null>(null)

  const exec = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editor.selection?.syncNow()
    refresh()
  }

  const restoreSelection = () => {
    const selection = window.getSelection()
    if (selection && savedRangeRef.current) {
      selection.removeAllRanges()
      selection.addRange(savedRangeRef.current)
    }
  }

  return (
    <div className="flex items-center gap-0.5" onMouseDown={(e) => e.preventDefault()}>
      <FormatButton title="Negrita" pressed={format.bold} onClick={() => exec('bold')}>
        <b>N</b>
      </FormatButton>
      <FormatButton title="Cursiva" pressed={format.italic} onClick={() => exec('italic')}>
        <i>K</i>
      </FormatButton>
      <FormatButton title="Tachado" pressed={format.strike} onClick={() => exec('strikeThrough')}>
        <s>S</s>
      </FormatButton>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <FormatButton title="Lista con viñetas" pressed={format.list === 'bullet'} onClick={() => exec('insertUnorderedList')}>
        •—
      </FormatButton>
      <FormatButton title="Lista numerada" pressed={format.list === 'number'} onClick={() => exec('insertOrderedList')}>
        1.—
      </FormatButton>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <ColorPicker
        value={format.color}
        onChange={(hex) => {
          restoreSelection()
          exec('foreColor', hex)
        }}
        theme={theme}
        title="Color del texto"
        icon={
          <span className="flex flex-col items-center leading-none">
            <span className="text-[11px] font-bold">A</span>
            <span className="block h-0.5 w-3 rounded-sm" style={{ background: format.color ?? theme.text }} />
          </span>
        }
        onBeforeMoreColors={() => {
          const selection = window.getSelection()
          savedRangeRef.current = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null
        }}
      />
    </div>
  )
}
