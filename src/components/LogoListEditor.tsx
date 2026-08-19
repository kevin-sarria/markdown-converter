import { useRef } from 'react'
import { fileToDataUrl } from '../lib/headerFooter'
import { makeLogoId, type LogoItem } from '../lib/logos'
import AlignPicker from './AlignPicker'

interface LogoListEditorProps {
  logos: LogoItem[]
  onChange: (logos: LogoItem[]) => void
  /** Upper bound for the per-logo width slider (mm) — cover logos can go bigger than header logos. */
  maxWidthMm?: number
}

export default function LogoListEditor({ logos, onChange, maxWidthMm = 40 }: LogoListEditorProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    onChange([...logos, { id: makeLogoId(), dataUrl, widthMm: Math.min(18, maxWidthMm), align: 'left' }])
  }

  const update = (id: string, patch: Partial<LogoItem>) =>
    onChange(logos.map((logo) => (logo.id === id ? { ...logo, ...patch } : logo)))

  const remove = (id: string) => onChange(logos.filter((logo) => logo.id !== id))

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= logos.length) return
    const next = [...logos]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {logos.map((logo, index) => (
        <div key={logo.id} className="flex flex-col gap-2 rounded-md border border-white/10 p-2">
          <div className="flex items-center gap-2">
            <img src={logo.dataUrl} alt="logo" className="h-9 w-auto rounded bg-white/5 object-contain p-1" />
            <div className="flex flex-1 items-center gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="rounded px-1.5 py-0.5 text-xs text-white/50 hover:text-white disabled:opacity-30"
                title="Subir"
              >
                ↑
              </button>
              <button
                type="button"
                disabled={index === logos.length - 1}
                onClick={() => move(index, 1)}
                className="rounded px-1.5 py-0.5 text-xs text-white/50 hover:text-white disabled:opacity-30"
                title="Bajar"
              >
                ↓
              </button>
            </div>
            <button
              type="button"
              onClick={() => remove(logo.id)}
              className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-white/25 hover:text-white"
            >
              Quitar
            </button>
          </div>
          <AlignPicker value={logo.align} onChange={(align) => update(logo.id, { align })} />
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={8}
              max={maxWidthMm}
              step={1}
              value={logo.widthMm}
              onChange={(e) => update(logo.id, { widthMm: Number(e.target.value) })}
              className="w-full accent-indigo-400"
            />
            <span className="w-14 shrink-0 text-right text-xs text-white/60">{logo.widthMm}mm</span>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-dashed border-white/20 px-3 py-2 text-left text-xs text-white/50 hover:border-white/40 hover:text-white/80"
      >
        + Agregar logo…
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleUpload(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
