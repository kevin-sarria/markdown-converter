import { useState } from 'react'
import { COLOR_THEMES, FONT_PAIRINGS, MARGINS, PAGE_SIZES, type Margin, type PageSize } from '../lib/themes'
import type { DocSettings } from '../lib/settings'
import HeaderFooterPanel from './HeaderFooterPanel'

interface SettingsPanelProps {
  settings: DocSettings
  onChange: (patch: Partial<DocSettings>) => void
}

type Tab = 'style' | 'headerFooter'

export default function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const [tab, setTab] = useState<Tab>('style')

  return (
    <div className="flex h-full w-full shrink-0 flex-col gap-6 overflow-y-auto border-l border-white/5 bg-[#0f1015] p-4 lg:w-72">
      <div className="flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
        <button
          type="button"
          onClick={() => setTab('style')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            tab === 'style' ? 'bg-indigo-400/20 text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Estilo
        </button>
        <button
          type="button"
          onClick={() => setTab('headerFooter')}
          className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition ${
            tab === 'headerFooter' ? 'bg-indigo-400/20 text-white' : 'text-white/50 hover:text-white/80'
          }`}
        >
          Encabezado / Marca de agua
        </button>
      </div>

      {tab === 'headerFooter' && <HeaderFooterPanel settings={settings} onChange={onChange} />}

      {tab === 'style' && (
        <>
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Paleta de colores
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_THEMES.map((theme) => {
            const active = theme.id === settings.themeId
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onChange({ themeId: theme.id })}
                className={`flex flex-col items-start gap-2 rounded-lg border p-2 text-left transition ${
                  active
                    ? 'border-indigo-400/70 bg-indigo-400/10 ring-1 ring-indigo-400/50'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <div className="flex h-6 w-full overflow-hidden rounded">
                  {theme.swatch.map((c, i) => (
                    <span key={i} className="h-full flex-1" style={{ background: c }} />
                  ))}
                </div>
                <span className="text-xs text-white/70">{theme.name}</span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Tipografía
        </h3>
        <div className="flex flex-col gap-1.5">
          {FONT_PAIRINGS.map((font) => {
            const active = font.id === settings.fontId
            return (
              <button
                key={font.id}
                type="button"
                onClick={() => onChange({ fontId: font.id })}
                className={`rounded-lg border px-3 py-2 text-left transition ${
                  active
                    ? 'border-indigo-400/70 bg-indigo-400/10 ring-1 ring-indigo-400/50'
                    : 'border-white/10 hover:border-white/25'
                }`}
              >
                <span className="block text-sm text-white/85" style={{ fontFamily: font.preview }}>
                  {font.name}
                </span>
              </button>
            )
          })}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Tamaño de texto
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={9}
            max={18}
            step={0.5}
            value={settings.fontSizePt}
            onChange={(e) => onChange({ fontSizePt: Number(e.target.value) })}
            className="w-full accent-indigo-400"
          />
          <span className="w-12 shrink-0 text-right text-xs text-white/60">
            {settings.fontSizePt}pt
          </span>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Interlineado
        </h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1.2}
            max={2.2}
            step={0.1}
            value={settings.lineHeight}
            onChange={(e) => onChange({ lineHeight: Number(e.target.value) })}
            className="w-full accent-indigo-400"
          />
          <span className="w-12 shrink-0 text-right text-xs text-white/60">
            {settings.lineHeight.toFixed(1)}
          </span>
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Tamaño de página
        </h3>
        <div className="flex gap-2">
          {(Object.keys(PAGE_SIZES) as PageSize[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ pageSize: key })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition ${
                settings.pageSize === key
                  ? 'border-indigo-400/70 bg-indigo-400/10 text-white'
                  : 'border-white/10 text-white/60 hover:border-white/25'
              }`}
            >
              {PAGE_SIZES[key].label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-white/40">
          Márgenes
        </h3>
        <div className="flex gap-2">
          {(Object.keys(MARGINS) as Margin[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onChange({ margin: key })}
              className={`flex-1 rounded-lg border px-2 py-1.5 text-xs transition ${
                settings.margin === key
                  ? 'border-indigo-400/70 bg-indigo-400/10 text-white'
                  : 'border-white/10 text-white/60 hover:border-white/25'
              }`}
            >
              {MARGINS[key].label}
            </button>
          ))}
        </div>
      </section>
        </>
      )}
    </div>
  )
}
