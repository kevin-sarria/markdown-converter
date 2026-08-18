export interface ColorTheme {
  id: string
  name: string
  /** page background */
  bg: string
  /** body text */
  text: string
  /** muted/secondary text */
  muted: string
  /** headings */
  heading: string
  /** links, blockquote bar, list markers, table header accents */
  accent: string
  /** subtle borders / hr / table borders */
  border: string
  /** inline & block code background */
  codeBg: string
  /** inline & block code text */
  codeText: string
  /** table header row background */
  tableHeadBg: string
  /** blockquote background tint (precomputed — html2canvas can't parse color-mix()) */
  blockquoteBg: string
  /** swatch shown in the picker */
  swatch: [string, string, string]
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const RAW_THEMES: Omit<ColorTheme, 'blockquoteBg'>[] = [
  {
    id: 'clean-light',
    name: 'Clean Light',
    bg: '#ffffff',
    text: '#27272a',
    muted: '#6b7280',
    heading: '#111114',
    accent: '#2563eb',
    border: '#e4e4e7',
    codeBg: '#f4f4f5',
    codeText: '#be123c',
    tableHeadBg: '#f4f4f5',
    swatch: ['#ffffff', '#111114', '#2563eb'],
  },
  {
    id: 'midnight',
    name: 'Midnight Dark',
    bg: '#14151c',
    text: '#d4d4d8',
    muted: '#8b8d98',
    heading: '#f4f4f5',
    accent: '#a78bfa',
    border: '#2b2d38',
    codeBg: '#1e2029',
    codeText: '#f0abfc',
    tableHeadBg: '#1e2029',
    swatch: ['#14151c', '#f4f4f5', '#a78bfa'],
  },
  {
    id: 'sepia',
    name: 'Sepia Paper',
    bg: '#faf3e6',
    text: '#4a3f2c',
    muted: '#8a7a5c',
    heading: '#332711',
    accent: '#a1662f',
    border: '#e3d5b8',
    codeBg: '#f1e6cc',
    codeText: '#8a4b17',
    tableHeadBg: '#f1e6cc',
    swatch: ['#faf3e6', '#332711', '#a1662f'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bg: '#f4fbfd',
    text: '#1e3a44',
    muted: '#5c7b85',
    heading: '#0c2a33',
    accent: '#0891b2',
    border: '#cfeaf0',
    codeBg: '#e3f4f7',
    codeText: '#0e7490',
    tableHeadBg: '#e3f4f7',
    swatch: ['#f4fbfd', '#0c2a33', '#0891b2'],
  },
  {
    id: 'forest',
    name: 'Forest',
    bg: '#f5faf5',
    text: '#233a27',
    muted: '#63806a',
    heading: '#152a19',
    accent: '#15803d',
    border: '#d7e9d9',
    codeBg: '#e6f2e7',
    codeText: '#166534',
    tableHeadBg: '#e6f2e7',
    swatch: ['#f5faf5', '#152a19', '#15803d'],
  },
  {
    id: 'slate',
    name: 'Slate Professional',
    bg: '#ffffff',
    text: '#334155',
    muted: '#64748b',
    heading: '#0f172a',
    accent: '#1d4ed8',
    border: '#dde3ea',
    codeBg: '#eef1f5',
    codeText: '#334155',
    tableHeadBg: '#eef1f5',
    swatch: ['#ffffff', '#0f172a', '#1d4ed8'],
  },
  {
    id: 'rose',
    name: 'Rose',
    bg: '#fff8f8',
    text: '#4a2530',
    muted: '#93697a',
    heading: '#3a1420',
    accent: '#e11d48',
    border: '#f6dbe0',
    codeBg: '#fceef0',
    codeText: '#be123c',
    tableHeadBg: '#fceef0',
    swatch: ['#fff8f8', '#3a1420', '#e11d48'],
  },
  {
    id: 'mono',
    name: 'Minimal Mono',
    bg: '#ffffff',
    text: '#111111',
    muted: '#666666',
    heading: '#000000',
    accent: '#000000',
    border: '#111111',
    codeBg: '#f0f0f0',
    codeText: '#111111',
    tableHeadBg: '#111111',
    swatch: ['#ffffff', '#111111', '#666666'],
  },
]

export const COLOR_THEMES: ColorTheme[] = RAW_THEMES.map((t) => ({
  ...t,
  blockquoteBg: hexToRgba(t.accent, 0.08),
}))

export interface FontPairing {
  id: string
  name: string
  /** CSS font-family stack for headings */
  heading: string
  /** CSS font-family stack for body text */
  body: string
  /** CSS font-family stack for code */
  mono: string
  /** docx font names (must match a real installed/embedded font name) */
  docx: { heading: string; body: string; mono: string }
  preview: string
}

export const FONT_PAIRINGS: FontPairing[] = [
  {
    id: 'inter',
    name: 'Inter — Moderno',
    heading: "'Inter', system-ui, sans-serif",
    body: "'Inter', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    docx: { heading: 'Inter', body: 'Inter', mono: 'JetBrains Mono' },
    preview: "'Inter', system-ui, sans-serif",
  },
  {
    id: 'classic-serif',
    name: 'Georgia — Clásico',
    heading: "Georgia, 'Times New Roman', serif",
    body: "Georgia, 'Times New Roman', serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    docx: { heading: 'Georgia', body: 'Georgia', mono: 'Consolas' },
    preview: "Georgia, serif",
  },
  {
    id: 'merriweather',
    name: 'Merriweather — Editorial',
    heading: "'Merriweather', Georgia, serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    mono: "'Fira Code', ui-monospace, monospace",
    docx: { heading: 'Merriweather', body: 'Source Sans Pro', mono: 'Consolas' },
    preview: "'Merriweather', Georgia, serif",
  },
  {
    id: 'elegant',
    name: 'Playfair — Elegante',
    heading: "'Playfair Display', Georgia, serif",
    body: "'Lora', Georgia, serif",
    mono: "'IBM Plex Mono', ui-monospace, monospace",
    docx: { heading: 'Playfair Display', body: 'Lora', mono: 'Consolas' },
    preview: "'Playfair Display', serif",
  },
  {
    id: 'slab',
    name: 'Roboto Slab — Firme',
    heading: "'Roboto Slab', serif",
    body: "'Source Sans 3', system-ui, sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    docx: { heading: 'Roboto Slab', body: 'Source Sans Pro', mono: 'Consolas' },
    preview: "'Roboto Slab', serif",
  },
  {
    id: 'system',
    name: 'Sistema — Simple',
    heading: "system-ui, 'Segoe UI', Arial, sans-serif",
    body: "system-ui, 'Segoe UI', Arial, sans-serif",
    mono: "ui-monospace, Consolas, monospace",
    docx: { heading: 'Calibri', body: 'Calibri', mono: 'Consolas' },
    preview: "system-ui, 'Segoe UI', Arial, sans-serif",
  },
]

export type PageSize = 'a4' | 'letter'
export type Margin = 'narrow' | 'normal' | 'wide'

export const PAGE_SIZES: Record<PageSize, { label: string; widthMm: number; heightMm: number }> = {
  a4: { label: 'A4', widthMm: 210, heightMm: 297 },
  letter: { label: 'Carta (Letter)', widthMm: 215.9, heightMm: 279.4 },
}

export const MARGINS: Record<Margin, { label: string; mm: number }> = {
  narrow: { label: 'Angosto', mm: 12 },
  normal: { label: 'Normal', mm: 20 },
  wide: { label: 'Amplio', mm: 28 },
}
