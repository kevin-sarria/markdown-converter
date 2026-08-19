import type { LogoAlign } from '../lib/logos'

const ALIGN_OPTIONS: { value: LogoAlign; label: string }[] = [
  { value: 'left', label: 'Izq.' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Der.' },
]

interface AlignPickerProps {
  value: LogoAlign
  onChange: (v: LogoAlign) => void
}

export default function AlignPicker({ value, onChange }: AlignPickerProps) {
  return (
    <div className="flex gap-1">
      {ALIGN_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`flex-1 rounded-md border px-2 py-1 text-[11px] transition ${
            value === opt.value
              ? 'border-indigo-400/70 bg-indigo-400/10 text-white'
              : 'border-white/10 text-white/60 hover:border-white/25'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
