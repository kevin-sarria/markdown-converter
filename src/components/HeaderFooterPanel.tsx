import { useRef } from 'react'
import type { CoverPageSettings } from '../lib/coverPage'
import type { HeaderFooterSettings, WatermarkSettings } from '../lib/headerFooter'
import { optimizeImageFile } from '../lib/imageOptimize'
import type { DocSettings } from '../lib/settings'
import AlignPicker from './AlignPicker'
import LogoListEditor from './LogoListEditor'
import Toggle from './Toggle'

interface HeaderFooterPanelProps {
  settings: DocSettings
  onChange: (patch: Partial<DocSettings>) => void
}

// The watermark sits behind full-page content but is meant to stay subtle —
// no need for a huge original either.
const WATERMARK_MAX_DIMENSION = 1200

export default function HeaderFooterPanel({ settings, onChange }: HeaderFooterPanelProps) {
  const hf = settings.headerFooter
  const wm = settings.watermark
  const cover = settings.coverPage
  const watermarkImageInputRef = useRef<HTMLInputElement>(null)

  const patchHf = (patch: Partial<HeaderFooterSettings>) => onChange({ headerFooter: { ...hf, ...patch } })
  const patchWm = (patch: Partial<WatermarkSettings>) => onChange({ watermark: { ...wm, ...patch } })
  const patchCover = (patch: Partial<CoverPageSettings>) => onChange({ coverPage: { ...cover, ...patch } })

  const handleWatermarkImageUpload = async (file: File | undefined) => {
    if (!file) return
    const dataUrl = await optimizeImageFile(file, { maxDimension: WATERMARK_MAX_DIMENSION })
    patchWm({ imageDataUrl: dataUrl })
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">Portada</h3>
        <Toggle checked={cover.enabled} onChange={(v) => patchCover({ enabled: v })} label="Activar" />
        {cover.enabled && (
          <p className="text-xs leading-relaxed text-white/40">
            Escribí el contenido directamente en la primera página de la vista previa — título, texto, imágenes,
            lo que necesites, con la misma barra de herramientas que el resto del documento.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-white/40">
          Encabezado y pie de página
        </h3>
        <Toggle checked={hf.enabled} onChange={(v) => patchHf({ enabled: v })} label="Activar" />

        {hf.enabled && (
          <div className="flex flex-col gap-4 rounded-lg border border-white/10 p-3">
            <div className="flex flex-col gap-2">
              <span className="text-xs text-white/50">Logos</span>
              <LogoListEditor logos={hf.logos} onChange={(logos) => patchHf({ logos })} />
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

            {!cover.enabled && (
              <Toggle
                checked={hf.showOnFirstPage}
                onChange={(v) => patchHf({ showOnFirstPage: v })}
                label="Mostrar en la primera página"
              />
            )}
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
