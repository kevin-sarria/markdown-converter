import { useRef } from 'react'
import { fileToDataUrl, type HFAlign, type HeaderFooterSettings, type WatermarkSettings } from '../lib/headerFooter'
import type { DocSettings } from '../lib/settings'

interface HeaderFooterPanelProps {
  settings: DocSettings
  onChange: (patch: Partial<DocSettings>) => void
}

const ALIGN_OPTIONS: { value: HFAlign; label: string }[] = [
  { value: 'left', label: 'Izq.' },
  { value: 'center', label: 'Centro' },
  { value: 'right', label: 'Der.' },
]

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs text-white/70">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${checked ? 'bg-indigo-500' : 'bg-white/15'}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition ${checked ? 'left-[18px]' : 'left-0.5'}`}
        />
      </button>
    </label>
  )
}

function AlignPicker({ value, onChange }: { value: HFAlign; onChange: (v: HFAlign) => void }) {
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

export default function HeaderFooterPanel({ settings, onChange }: HeaderFooterPanelProps) {
  const hf = settings.headerFooter
  const wm = settings.watermark
  const logoInputRef = useRef<HTMLInputElement>(null)
  const watermarkImageInputRef = useRef<HTMLInputElement>(null)

  const patchHf = (patch: Partial<HeaderFooterSettings>) => onChange({ headerFooter: { ...hf, ...patch } })
  const patchWm = (patch: Partial<WatermarkSettings>) => onChange({ watermark: { ...wm, ...patch } })

  const handleLogoUpload = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    patchHf({ logoDataUrl: dataUrl })
  }

  const handleWatermarkImageUpload = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    patchWm({ imageDataUrl: dataUrl })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
            Encabezado y pie de página
          </h3>
        </div>
        <Toggle checked={hf.enabled} onChange={(v) => patchHf({ enabled: v })} label="Activar" />

        {hf.enabled && (
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 p-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Logo</span>
              {hf.logoDataUrl ? (
                <div className="flex items-center gap-2">
                  <img src={hf.logoDataUrl} alt="logo" className="h-10 w-auto rounded bg-white/5 object-contain p-1" />
                  <button
                    type="button"
                    onClick={() => patchHf({ logoDataUrl: null })}
                    className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-white/25 hover:text-white"
                  >
                    Quitar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-md border border-dashed border-white/20 px-3 py-2 text-left text-xs text-white/50 hover:border-white/40 hover:text-white/80"
                >
                  Subir imagen…
                </button>
              )}
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleLogoUpload(e.target.files?.[0])}
              />
              {hf.logoDataUrl && (
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={8}
                    max={40}
                    step={1}
                    value={hf.logoWidthMm}
                    onChange={(e) => patchHf({ logoWidthMm: Number(e.target.value) })}
                    className="w-full accent-indigo-400"
                  />
                  <span className="w-14 shrink-0 text-right text-xs text-white/60">{hf.logoWidthMm}mm</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Texto del encabezado</span>
              <input
                value={hf.headerText}
                onChange={(e) => patchHf({ headerText: e.target.value })}
                placeholder="Nombre de la empresa…"
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-400/60"
              />
              <AlignPicker value={hf.headerAlign} onChange={(v) => patchHf({ headerAlign: v })} />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Texto del pie de página</span>
              <input
                value={hf.footerText}
                onChange={(e) => patchHf({ footerText: e.target.value })}
                placeholder="Confidencial · uso interno…"
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-400/60"
              />
              <AlignPicker value={hf.footerAlign} onChange={(v) => patchHf({ footerAlign: v })} />
            </div>

            <Toggle checked={hf.showPageNumber} onChange={(v) => patchHf({ showPageNumber: v })} label="Número de página" />
            {hf.showPageNumber && (
              <input
                value={hf.pageNumberFormat}
                onChange={(e) => patchHf({ pageNumberFormat: e.target.value })}
                placeholder="Página {page} de {pages}"
                className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-400/60"
              />
            )}

            <Toggle
              checked={hf.showOnFirstPage}
              onChange={(v) => patchHf({ showOnFirstPage: v })}
              label="Mostrar en la primera página"
            />
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Marca de agua</h3>
        <Toggle checked={wm.enabled} onChange={(v) => patchWm({ enabled: v })} label="Activar" />

        {wm.enabled && (
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 p-3">
            <div className="flex gap-2">
              {(['text', 'image'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => patchWm({ type })}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-xs transition ${
                    wm.type === type
                      ? 'border-indigo-400/70 bg-indigo-400/10 text-white'
                      : 'border-white/10 text-white/60 hover:border-white/25'
                  }`}
                >
                  {type === 'text' ? 'Texto' : 'Imagen'}
                </button>
              ))}
            </div>

            {wm.type === 'text' ? (
              <div className="flex flex-col gap-2">
                <input
                  value={wm.text}
                  onChange={(e) => patchWm({ text: e.target.value })}
                  placeholder="CONFIDENCIAL"
                  className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-white/80 outline-none focus:border-indigo-400/60"
                />
                <div className="flex items-center gap-3">
                  <span className="text-xs text-white/50">Color</span>
                  <input
                    type="color"
                    value={wm.color}
                    onChange={(e) => patchWm({ color: e.target.value })}
                    className="h-7 w-10 rounded border border-white/10 bg-transparent"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-white/50">Tamaño</span>
                  <input
                    type="range"
                    min={20}
                    max={120}
                    step={2}
                    value={wm.fontSizePt}
                    onChange={(e) => patchWm({ fontSizePt: Number(e.target.value) })}
                    className="w-full accent-indigo-400"
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {wm.imageDataUrl ? (
                  <div className="flex items-center gap-2">
                    <img
                      src={wm.imageDataUrl}
                      alt="marca de agua"
                      className="h-10 w-auto rounded bg-white/5 object-contain p-1"
                    />
                    <button
                      type="button"
                      onClick={() => patchWm({ imageDataUrl: null })}
                      className="rounded-md border border-white/10 px-2 py-1 text-xs text-white/60 hover:border-white/25 hover:text-white"
                    >
                      Quitar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => watermarkImageInputRef.current?.click()}
                    className="rounded-md border border-dashed border-white/20 px-3 py-2 text-left text-xs text-white/50 hover:border-white/40 hover:text-white/80"
                  >
                    Subir imagen…
                  </button>
                )}
                <input
                  ref={watermarkImageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleWatermarkImageUpload(e.target.files?.[0])}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-white/50">Opacidad</span>
              <input
                type="range"
                min={0.05}
                max={0.6}
                step={0.05}
                value={wm.opacity}
                onChange={(e) => patchWm({ opacity: Number(e.target.value) })}
                className="w-full accent-indigo-400"
              />
              <span className="w-10 shrink-0 text-right text-xs text-white/60">{Math.round(wm.opacity * 100)}%</span>
            </div>

            <div className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-xs text-white/50">Rotación</span>
              <input
                type="range"
                min={-90}
                max={90}
                step={5}
                value={wm.rotationDeg}
                onChange={(e) => patchWm({ rotationDeg: Number(e.target.value) })}
                className="w-full accent-indigo-400"
              />
              <span className="w-10 shrink-0 text-right text-xs text-white/60">{wm.rotationDeg}°</span>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
