import { useEffect, useRef, useState, type ReactNode } from 'react'
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
 * Office-style color picker: a single compact button showing the current
 * color, which opens a dropdown with theme colors, a standard palette, and
 * "Más colores…" — the same shape as PowerPoint's font/fill color button,
 * rather than spelling every swatch out in the toolbar itself (that's what
 * made the floating toolbar so wide before this).
 *
 * "Más colores…" opens the operating system's own color dialog via a hidden
 * `<input type="color">`, rather than a picker built from scratch here.
 *
 * Used both for a canvas box's whole-box color (CanvasStyleBar.tsx) and for a
 * per-word text color (CanvasTextFormatBar.tsx) — the two differ only in
 * what `onChange` does with the hex it's handed, and in the icon/title they
 * pass so the button reads as "box" vs "text".
 */
export default function ColorPicker({
  value,
  onChange,
  onClear,
  theme,
  onBeforeMoreColors,
  title = 'Color',
  icon,
}: {
  value: string | null
  onChange: (hex: string) => void
  onClear?: () => void
  theme: ColorTheme
  onBeforeMoreColors?: () => void
  title?: string
  icon?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const nativeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const pick = (hex: string) => {
    onChange(hex)
    setOpen(false)
  }

  const themeSwatches = [
    { color: theme.heading, title: 'Color de títulos del tema' },
    { color: theme.text, title: 'Color de texto del tema' },
    { color: theme.muted, title: 'Color atenuado del tema' },
    { color: theme.accent, title: 'Color de acento del tema' },
  ]

  const swatch = (color: string, swatchTitle: string) => (
    <button
      key={color}
      type="button"
      title={swatchTitle}
      onClick={() => pick(color)}
      className={`h-5 w-5 rounded-sm border ${
        value?.toLowerCase() === color.toLowerCase() ? 'border-white' : 'border-white/25'
      }`}
      style={{ background: color }}
    />
  )

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="flex h-6 items-center gap-1 rounded border border-white/10 px-1 text-white/70 hover:bg-white/10 hover:text-white"
      >
        {icon ?? <span className="h-3 w-3 rounded-sm border border-white/25" style={{ background: value ?? theme.text }} />}
        <span className="text-[8px] leading-none">▾</span>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-40 mt-1 w-44 rounded-md border border-white/10 bg-[#111219] p-2 shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="mb-1 text-[10px] text-white/40">Colores del tema</p>
          <div className="grid grid-cols-7 gap-1">{themeSwatches.map(({ color, title: t }) => swatch(color, t))}</div>

          <p className="mb-1 mt-2 text-[10px] text-white/40">Colores estándar</p>
          <div className="grid grid-cols-7 gap-1">{STANDARD_COLORS.map((color) => swatch(color, color))}</div>

          <div className="mt-2 flex flex-col gap-1 border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => {
                onBeforeMoreColors?.()
                nativeInputRef.current?.click()
                setOpen(false)
              }}
              className="rounded px-1 py-0.5 text-left text-xs text-white/70 hover:bg-white/10 hover:text-white"
            >
              Más colores…
            </button>
            {onClear && (
              <button
                type="button"
                onClick={() => {
                  onClear()
                  setOpen(false)
                }}
                className="rounded px-1 py-0.5 text-left text-xs text-white/50 hover:bg-white/10 hover:text-white"
              >
                Volver al color del documento
              </button>
            )}
          </div>

          <input
            ref={nativeInputRef}
            type="color"
            value={value ?? '#000000'}
            onChange={(e) => pick(e.target.value)}
            className="sr-only"
          />
        </div>
      )}
    </div>
  )
}
