import {
  AlignmentType,
  BorderStyle,
  Footer,
  Header,
  HorizontalPositionAlign,
  HorizontalPositionRelativeFrom,
  ImageRun,
  PageBreak,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  VerticalPositionAlign,
  VerticalPositionRelativeFrom,
  WidthType,
  type ParagraphChild,
} from 'docx'
import type { CoverPageSettings } from './coverPage'
import type { HeaderFooterSettings, WatermarkSettings } from './headerFooter'
import { groupLogosByAlign, type LogoAlign, type LogoItem } from './logos'
import type { getFontPairing } from './settings'

type FontPairing = ReturnType<typeof getFontPairing>

const PX_PER_MM = 96 / 25.4
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const NO_BORDERS = { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER }

interface ImageAsset {
  data: Uint8Array
  type: 'jpg' | 'png' | 'gif' | 'bmp'
  width: number
  height: number
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function sniffImageType(bytes: Uint8Array): ImageAsset['type'] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif'
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp'
  return null
}

function loadImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 })
    img.onerror = () => resolve({ width: 300, height: 200 })
    img.src = dataUrl
  })
}

async function loadImageAssetFromDataUrl(dataUrl: string): Promise<ImageAsset | null> {
  const bytes = dataUrlToUint8Array(dataUrl)
  const type = sniffImageType(bytes)
  if (!type) return null
  const { width, height } = await loadImageDimensions(dataUrl)
  return { data: bytes, type, width, height }
}

function alignmentFor(align: LogoAlign) {
  return align === 'left' ? AlignmentType.LEFT : align === 'right' ? AlignmentType.RIGHT : AlignmentType.CENTER
}

/** Loads a group of logos as ImageRuns, with a small spacer between consecutive ones. */
async function buildLogoRuns(logos: LogoItem[], font: FontPairing): Promise<ParagraphChild[]> {
  const runs: ParagraphChild[] = []
  for (const logo of logos) {
    const asset = await loadImageAssetFromDataUrl(logo.dataUrl)
    if (!asset) continue
    if (runs.length > 0) runs.push(new TextRun({ text: '  ', font: font.docx.body }))
    const width = Math.round(logo.widthMm * PX_PER_MM)
    const height = Math.round(width * (asset.height / asset.width))
    runs.push(new ImageRun({ type: asset.type, data: asset.data, transformation: { width, height } }))
  }
  return runs
}

/** A borderless 1-row × 3-column table used for left/center/right layouts (header logos, cover logos). */
function buildThreeSlotTable(cells: Record<LogoAlign, ParagraphChild[]>): Table | null {
  const hasContent = cells.left.length > 0 || cells.center.length > 0 || cells.right.length > 0
  if (!hasContent) return null

  const cell = (align: LogoAlign) =>
    new TableCell({
      width: { size: 33.33, type: WidthType.PERCENTAGE },
      borders: NO_BORDERS,
      children: [new Paragraph({ alignment: alignmentFor(align), children: cells[align] })],
    })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...NO_BORDERS, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [new TableRow({ children: [cell('left'), cell('center'), cell('right')] })],
  })
}

/**
 * docx.js has no native rotated/transparent text, so the watermark is rasterized
 * to a PNG (off-screen canvas) the same way Word itself implements watermarks —
 * as a floating image behind the text, placed in the header so it repeats on
 * every page.
 */
async function renderWatermarkPng(wm: WatermarkSettings): Promise<{ data: Uint8Array; width: number; height: number } | null> {
  const size = 1000
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.globalAlpha = wm.opacity
  ctx.translate(size / 2, size / 2)
  ctx.rotate((wm.rotationDeg * Math.PI) / 180)

  if (wm.type === 'image' && wm.imageDataUrl) {
    const dims = await loadImageDimensions(wm.imageDataUrl)
    const img = new Image()
    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      img.onerror = () => resolve()
      img.src = wm.imageDataUrl as string
    })
    const scale = Math.min((size * 0.8) / dims.width, (size * 0.8) / dims.height)
    const w = dims.width * scale
    const h = dims.height * scale
    ctx.drawImage(img, -w / 2, -h / 2, w, h)
  } else if (wm.type === 'text' && wm.text) {
    ctx.fillStyle = wm.color
    ctx.font = `bold ${Math.round(wm.fontSizePt * 3)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(wm.text, 0, 0)
  } else {
    return null
  }

  const dataUrl = canvas.toDataURL('image/png')
  return { data: dataUrlToUint8Array(dataUrl), width: size, height: size }
}

async function watermarkImageRun(wm: WatermarkSettings): Promise<ImageRun | null> {
  const png = await renderWatermarkPng(wm)
  if (!png) return null
  return new ImageRun({
    type: 'png',
    data: png.data,
    transformation: { width: 420, height: 420 },
    floating: {
      horizontalPosition: { align: HorizontalPositionAlign.CENTER, relative: HorizontalPositionRelativeFrom.PAGE },
      verticalPosition: { align: VerticalPositionAlign.CENTER, relative: VerticalPositionRelativeFrom.PAGE },
      behindDocument: true,
      wrap: { type: TextWrappingType.NONE },
    },
  })
}

/**
 * Builds the section's header: a 3-column (left/center/right) table for the logos
 * plus the header text in its aligned slot, and the watermark's floating image
 * (docx only allows one `default` header per section, so both live here when
 * both are enabled).
 */
export async function buildHeader(hf: HeaderFooterSettings, watermark: WatermarkSettings, font: FontPairing): Promise<Header | undefined> {
  const cells: Record<LogoAlign, ParagraphChild[]> = { left: [], center: [], right: [] }

  if (hf.enabled) {
    const groups = groupLogosByAlign(hf.logos)
    cells.left = await buildLogoRuns(groups.left, font)
    cells.center = await buildLogoRuns(groups.center, font)
    cells.right = await buildLogoRuns(groups.right, font)

    if (hf.headerText) {
      if (cells[hf.headerAlign].length > 0) cells[hf.headerAlign].push(new TextRun({ text: '  ', font: font.docx.body }))
      cells[hf.headerAlign].push(new TextRun({ text: hf.headerText, font: font.docx.body, size: 18, color: '666666' }))
    }
  }

  const watermarkRun = watermark.enabled ? await watermarkImageRun(watermark) : null
  const table = buildThreeSlotTable(cells)

  if (!table && !watermarkRun) return undefined

  const children: (Paragraph | Table)[] = []
  if (watermarkRun) children.push(new Paragraph({ children: [watermarkRun] }))
  if (table) children.push(table)

  return new Header({ children })
}

export function buildFooter(hf: HeaderFooterSettings, font: FontPairing): Footer | undefined {
  if (!hf.enabled) return undefined
  const children: ParagraphChild[] = []

  if (hf.footerText) children.push(new TextRun({ text: hf.footerText, font: font.docx.body, size: 18 }))

  if (hf.showPageNumber) {
    if (children.length > 0) children.push(new TextRun({ text: '   ·   ', font: font.docx.body, size: 18 }))
    const [before, rest] = hf.pageNumberFormat.split('{page}')
    const [middle, tail] = (rest ?? '').split('{pages}')
    if (before) children.push(new TextRun({ text: before, font: font.docx.body, size: 18 }))
    children.push(new TextRun({ children: [PageNumber.CURRENT], font: font.docx.body, size: 18 }))
    if (hf.pageNumberFormat.includes('{pages}')) {
      if (middle) children.push(new TextRun({ text: middle, font: font.docx.body, size: 18 }))
      children.push(new TextRun({ children: [PageNumber.TOTAL_PAGES], font: font.docx.body, size: 18 }))
      if (tail) children.push(new TextRun({ text: tail, font: font.docx.body, size: 18 }))
    } else if (middle) {
      children.push(new TextRun({ text: middle, font: font.docx.body, size: 18 }))
    }
  }

  if (children.length === 0) return undefined
  return new Footer({
    children: [new Paragraph({ alignment: alignmentFor(hf.footerAlign), children })],
  })
}

/**
 * Builds the leading cover-page content (logos row, title, subtitle) followed by
 * a hard page break, meant to be prepended to the document body. See
 * coverPage.ts's hasCoverContent for the check callers should use before calling
 * this.
 */
export async function buildCoverPageBlocks(cover: CoverPageSettings, font: FontPairing): Promise<(Paragraph | Table)[]> {
  const out: (Paragraph | Table)[] = []

  if (cover.logos.length > 0) {
    const groups = groupLogosByAlign(cover.logos)
    const table = buildThreeSlotTable({
      left: await buildLogoRuns(groups.left, font),
      center: await buildLogoRuns(groups.center, font),
      right: await buildLogoRuns(groups.right, font),
    })
    if (table) out.push(table)
  }

  out.push(new Paragraph({}))
  if (cover.title) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 800, after: 200 },
        children: [new TextRun({ text: cover.title, font: font.docx.heading, bold: true, size: 56 })],
      }),
    )
  }
  if (cover.subtitle) {
    out.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: cover.subtitle, font: font.docx.body, size: 28, color: '666666' })],
      }),
    )
  }
  out.push(new Paragraph({ children: [new PageBreak()] }))

  return out
}
