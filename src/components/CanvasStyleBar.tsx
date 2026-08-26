import { CANVAS_ALIGNS, MAX_SIZE_PT, MIN_SIZE_PT, type CanvasAlign, type CanvasFont } from '../lib/canvas'
import { getTheme } from '../lib/settings'
import ColorPicker from './ColorPicker'
import type { CanvasEditor } from '../hooks/useCanvasEditor'
import type { DocSettings } from '../lib/settings'

const ALIGN_ICON: Record<CanvasAlign, string> = {
  izquierda: '⯇',
  centro: '⯀',
  derecha: '⯈',
}

const ALIGN_TITLE: Record<CanvasAlign, string> = {
  izquierda: 'Alinear a la izquierda',
  centro: 'Centrar',
  derecha: 'Alinear a la derecha',
}

const FONTS: { id: CanvasFont; label: string; title: string }[] = [
  { id: 'titulo', label: 'Tt', title: 'Tipografía de títulos del tema' },
  { id: 'texto', label: 'Tx', title: 'Tipografía de texto del tema' },
  { id: 'mono', label: 'Mo', title: 'Tipografía monoespaciada del tema' },
]

/** A handful of sizes worth reaching for, rather than a free-for-all. */
const SIZE_STEPS = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 40, 48, 60, 72]

/**
 * Size, colour, alignment and typeface for the selected canvas text box.
 *
 * These live on the box, not on the words: Markdown can express **bold** and
 * *italic* (and the main toolbar still does those inside a box), but it has no
 * way to say "24pt, dark blue". Keeping the style on the box is what lets the
 * document stay Markdown instead of turning into HTML — see canvas.ts.
 *
 * The colour swatches come from the document's own palette, so the obvious
 * choice is the one that matches the rest of the document; the picker beside
 * them is there for a brand colour the theme doesn't have.
 */
export default function CanvasStyleBar({ editor, settings }: { editor: CanvasEditor; settings: DocSettings }) {
  const { style, setStyle } = editor
  const theme = getTheme(settings.themeId)

  const stepSize = (direction: 1 | -1) => {
    const current = style.sizePt ?? settings.fontSizePt
    const index = SIZE_STEPS.findIndex((s) => s >= current)
    const at = index === -1 ? SIZE_STEPS.length - 1 : index
    const next = SIZE_STEPS[Math.min(SIZE_STEPS.length - 1, Math.max(0, at + direction))]
    setStyle({ sizePt: next })
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        title="Reducir el tamaño"
        onClick={() => stepSize(-1)}
        className="flex h-6 w-6 items-center justify-center rounded text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        A−
      </button>
      <input
        type="number"
        min={MIN_SIZE_PT}
        max={MAX_SIZE_PT}
        // Empty means "inherit the document", which is a real state, not a blank.
        value={style.sizePt ?? ''}
        placeholder={String(settings.fontSizePt)}
        title="Tamaño en puntos — vacío sigue al documento"
        onChange={(e) => {
          const value = Number(e.target.value)
          setStyle({ sizePt: e.target.value === '' || !Number.isFinite(value) ? null : value })
        }}
        className="h-6 w-11 rounded border border-white/10 bg-white/5 px-1 text-center text-xs text-white/80 outline-none focus:border-indigo-400/60"
      />
      <button
        type="button"
        title="Aumentar el tamaño"
        onClick={() => stepSize(1)}
        className="flex h-6 w-6 items-center justify-center rounded text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        A+
      </button>

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      <ColorPicker
        value={style.color}
        onChange={(color) => setStyle({ color })}
        onClear={() => setStyle({ color: null })}
        theme={theme}
      />

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      {CANVAS_ALIGNS.map((align) => (
        <button
          key={align}
          type="button"
          title={ALIGN_TITLE[align]}
          onClick={() => setStyle({ align: style.align === align ? null : align })}
          className={`flex h-6 w-6 items-center justify-center rounded text-xs hover:bg-white/10 ${
            style.align === align ? 'bg-white/15 text-white' : 'text-white/60'
          }`}
        >
          {ALIGN_ICON[align]}
        </button>
      ))}

      <div className="mx-0.5 h-4 w-px bg-white/10" />

      {FONTS.map(({ id, label, title }) => (
        <button
          key={id}
          type="button"
          title={title}
          onClick={() => setStyle({ font: style.font === id ? null : id })}
          className={`flex h-6 w-6 items-center justify-center rounded text-[10px] hover:bg-white/10 ${
            style.font === id ? 'bg-white/15 text-white' : 'text-white/60'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
