import { useRef } from 'react'
import type { ColorTheme } from '../lib/themes'

/** Office's own "Standard Colors" row — a known, already-tested palette, and
 * the same one the user asked to be able to reach. */
const STANDARD_COLORS = [
  '#C00000',
  '#FF0000',
  '#FFC000',
  '#FFFF00',
  '#92D050',
  '#00B050',
  '#00B0F0',
  '#0070C0',
  '#002060',
  '#7030A0',
]

/**
 * Office-style color picker: theme colors, a standard palette, and "Más
 * colores…" for anything else — which just opens the operating system's own
 * color dialog via a hidden `<input type="color">`, rather than a picker
 * built from scratch here.
 *
 * Used both for a canvas box's whole-box color (CanvasStyleBar.tsx) and for a
 * per-word text color (CanvasTextFormatBar.tsx) — the two differ only in
 * what `onChange` does with the hex it's handed.
 */
export default function ColorPicker({
  value,
  onChange,
  onClear,
  theme,
  onBeforeMoreColors,
}: {
  value: string | null
  onChange: (hex: string) => void
  onClear?: () => void
  theme: ColorTheme
  onBeforeMoreColors?: () => void
}) {
  const nativeInputRef = useRef<HTMLInputElement>(null)

  const themeSwatches = [
    { color: theme.heading, title: 'Color de títulos del tema' },
    { color: theme.text, title: 'Color de texto del tema' },
    { color: theme.muted, title: 'Color atenuado del tema' },
    { color: theme.accent, title: 'Color de acento del tema' },
  ]

  const swatch = (color: string, title: string) => (
    <button
      key={color}
      type="button"
      title={title}
      onClick={() => onChange(color)}
      className={`h-4 w-4 rounded-sm border ${
        value?.toLowerCase() === color.toLowerCase() ? 'border-white' : 'border-white/25'
      }`}
      style={{ background: color }}
    />
  )

  return (
    <div className="flex items-center gap-0.5">
      {themeSwatches.map(({ color, title }) => swatch(color, title))}
      <div className="mx-0.5 h-4 w-px bg-white/10" />
      {STANDARD_COLORS.map((color) => swatch(color, color))}
      <div className="mx-0.5 h-4 w-px bg-white/10" />
      <button
        type="button"
        title="Más colores…"
        onClick={() => {
          onBeforeMoreColors?.()
          nativeInputRef.current?.click()
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-xs text-white/70 hover:bg-white/10 hover:text-white"
      >
        ⋯
      </button>
      <input
        ref={nativeInputRef}
        type="color"
        value={value ?? '#000000'}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
      />
      {onClear && (
        <button
          type="button"
          title="Volver al color del documento"
          onClick={onClear}
          className="flex h-6 w-6 items-center justify-center rounded text-xs text-white/50 hover:bg-white/10 hover:text-white"
        >
          ⌫
        </button>
      )}
    </div>
  )
}
