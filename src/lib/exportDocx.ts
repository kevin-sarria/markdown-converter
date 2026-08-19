import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ILevelsOptions,
} from 'docx'
import { saveAs } from 'file-saver'
import type { Token } from 'markdown-it'
import { buildFooter, buildHeader } from './docxHeaderFooter'
import { md } from './markdown'
import { getFontPairing, getTheme, type DocSettings } from './settings'
import { MARGINS, PAGE_SIZES } from './themes'

interface ListFrame {
  ordered: boolean
  numRef?: string
}

interface StyleCtx {
  listStack: ListFrame[]
  blockquote: boolean
  bulletPending: { value: boolean } | null
}

interface Cursor {
  i: number
}

interface ImageAsset {
  data: Uint8Array
  type: 'jpg' | 'png' | 'gif' | 'bmp'
  width: number
  height: number
}

const HEX = (color: string) => color.replace('#', '').toUpperCase()

function relativeLuminance(hex: string): number {
  const c = hex.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16) / 255
  const g = parseInt(c.slice(2, 4), 16) / 255
  const b = parseInt(c.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function hexPt(pt: number): number {
  return Math.round(pt * 2)
}

export async function buildDocxBlob(markdownText: string, settings: DocSettings): Promise<Blob> {
  const theme = getTheme(settings.themeId)
  const font = getFontPairing(settings.fontId)
  const page = PAGE_SIZES[settings.pageSize]
  const margin = MARGINS[settings.margin]

  const tokens = md.parse(markdownText || '', {})
  const images = await preloadImages(tokens)

  const numberingConfigs: { reference: string; levels: readonly ILevelsOptions[] }[] = []
  const cursor: Cursor = { i: 0 }
  const ctx: StyleCtx = { listStack: [], blockquote: false, bulletPending: null }

  // Word/print pages are always on white paper, unlike the on-screen preview.
  // Themes built for a dark on-screen background use light text, which would be
  // invisible on unshaded white paragraphs — so those two colors get swapped for
  // print-safe dark neutrals here. Anything with its own shading (code, blockquote,
  // table header) already carries a matching background and needs no adjustment.
  const isDarkTheme = relativeLuminance(theme.bg) < 0.5
  const safeHeading = isDarkTheme ? '1A1A1E' : HEX(theme.heading)
  const safeText = isDarkTheme ? '2A2A30' : HEX(theme.text)

  const body = convertBlocks(tokens, cursor, null, ctx, {
    theme,
    font,
    baseSize: settings.fontSizePt,
    lineHeight: settings.lineHeight,
    numberingConfigs,
    images,
    safeHeading,
    safeText,
  })

  const hf = settings.headerFooter
  const header = await buildHeader(hf, settings.watermark, font)
  const footer = buildFooter(hf, font)
  const showFirstPageBand = hf.enabled && !hf.showOnFirstPage

  const doc = new Document({
    numbering: { config: numberingConfigs },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: convertMillimetersToTwip(page.widthMm),
              height: convertMillimetersToTwip(page.heightMm),
            },
            margin: {
              top: convertMillimetersToTwip(margin.mm),
              bottom: convertMillimetersToTwip(margin.mm),
              left: convertMillimetersToTwip(margin.mm),
              right: convertMillimetersToTwip(margin.mm),
            },
          },
          titlePage: showFirstPageBand,
        },
        headers: header ? { default: header, ...(showFirstPageBand ? { first: new Header({ children: [] }) } : {}) } : undefined,
        footers: footer ? { default: footer, ...(showFirstPageBand ? { first: new Footer({ children: [] }) } : {}) } : undefined,
        children: body.length > 0 ? body : [new Paragraph({})],
      },
    ],
  })

  return Packer.toBlob(doc)
}

export async function exportToDocx(
  markdownText: string,
  settings: DocSettings,
  fileName: string,
): Promise<void> {
  const blob = await buildDocxBlob(markdownText, settings)
  saveAs(blob, `${fileName}.docx`)
}

interface BuildCtx {
  theme: ReturnType<typeof getTheme>
  font: ReturnType<typeof getFontPairing>
  baseSize: number
  lineHeight: number
  numberingConfigs: { reference: string; levels: readonly ILevelsOptions[] }[]
  images: Map<string, ImageAsset>
  /** print-safe (white-page) substitutes for theme.heading / theme.text — see exportToDocx */
  safeHeading: string
  safeText: string
}

function lineSpacing(build: BuildCtx) {
  return { line: Math.round(build.lineHeight * 240), lineRule: 'auto' as const }
}

function orderedLevels(): ILevelsOptions[] {
  const formats: (typeof LevelFormat)[keyof typeof LevelFormat][] = [
    LevelFormat.DECIMAL,
    LevelFormat.LOWER_LETTER,
    LevelFormat.LOWER_ROMAN,
  ]
  return [0, 1, 2, 3].map((level) => ({
    level,
    format: formats[level % formats.length],
    text: `%${level + 1}.`,
    alignment: AlignmentType.START,
    style: {
      paragraph: {
        indent: { left: 720 * (level + 1), hanging: 260 },
      },
    },
  }))
}

function makeOrderedListRef(build: BuildCtx): string {
  const reference = `ordered-${build.numberingConfigs.length}`
  build.numberingConfigs.push({ reference, levels: orderedLevels() })
  return reference
}

function convertBlocks(
  tokens: Token[],
  cursor: Cursor,
  stopType: string | null,
  ctx: StyleCtx,
  build: BuildCtx,
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []

  while (cursor.i < tokens.length) {
    const t = tokens[cursor.i]
    if (stopType && t.type === stopType) {
      cursor.i++
      break
    }

    switch (t.type) {
      case 'heading_open': {
        const level = Number(t.tag.slice(1))
        cursor.i++
        const inline = tokens[cursor.i]
        cursor.i += 2 // inline + heading_close
        out.push(headingParagraph(inline, level, build))
        break
      }
      case 'paragraph_open': {
        cursor.i++
        const inline = tokens[cursor.i]
        cursor.i += 2 // inline + paragraph_close
        out.push(bodyParagraph(inline, ctx, build))
        break
      }
      case 'bullet_list_open':
      case 'ordered_list_open': {
        const ordered = t.type === 'ordered_list_open'
        cursor.i++
        const frame: ListFrame = { ordered, numRef: ordered ? makeOrderedListRef(build) : undefined }
        ctx.listStack.push(frame)
        const closeType = ordered ? 'ordered_list_close' : 'bullet_list_close'
        const items = convertBlocks(tokens, cursor, closeType, ctx, build)
        ctx.listStack.pop()
        out.push(...items)
        break
      }
      case 'list_item_open': {
        cursor.i++
        const prevBullet = ctx.bulletPending
        ctx.bulletPending = { value: true }
        const items = convertBlocks(tokens, cursor, 'list_item_close', ctx, build)
        ctx.bulletPending = prevBullet
        out.push(...items)
        break
      }
      case 'blockquote_open': {
        cursor.i++
        const wasBlockquote = ctx.blockquote
        ctx.blockquote = true
        const inner = convertBlocks(tokens, cursor, 'blockquote_close', ctx, build)
        ctx.blockquote = wasBlockquote
        out.push(...inner)
        break
      }
      case 'code_block':
      case 'fence': {
        out.push(...codeBlockParagraphs(t.content, build))
        cursor.i++
        break
      }
      case 'hr': {
        out.push(hrParagraph(build))
        cursor.i++
        break
      }
      case 'table_open': {
        cursor.i++
        out.push(convertTable(tokens, cursor, build))
        break
      }
      default: {
        cursor.i++
      }
    }
  }

  return out
}

function baseIndent(ctx: StyleCtx) {
  const listDepth = ctx.listStack.length
  const left = listDepth > 0 ? 360 + (listDepth - 1) * 360 : ctx.blockquote ? 360 : undefined
  return left !== undefined ? { left } : undefined
}

function headingParagraph(inline: Token, level: number, build: BuildCtx): Paragraph {
  const scale = level === 1 ? 2.1 : level === 2 ? 1.6 : level === 3 ? 1.3 : level === 4 ? 1.1 : 1
  const size = hexPt(Math.round(build.baseSize * scale * 10) / 10)
  const runs = runsFromInline(inline?.children ?? [], {
    font: build.font.docx.heading,
    size,
    color: build.safeHeading,
    bold: true,
    images: build.images,
  })
  return new Paragraph({
    children: runs,
    spacing: { before: 320, after: 160 },
    border:
      level <= 2
        ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border), space: 4 } }
        : undefined,
  })
}

function bodyParagraph(inline: Token, ctx: StyleCtx, build: BuildCtx): Paragraph {
  const size = hexPt(build.baseSize)
  const runs = runsFromInline(inline?.children ?? [], {
    font: build.font.docx.body,
    size,
    color: ctx.blockquote ? HEX(build.theme.muted) : build.safeText,
    italic: ctx.blockquote,
    images: build.images,
  })

  const topFrame = ctx.listStack[ctx.listStack.length - 1]
  const applyBullet = Boolean(topFrame && ctx.bulletPending?.value)
  if (applyBullet && ctx.bulletPending) ctx.bulletPending.value = false

  return new Paragraph({
    children: runs.length > 0 ? runs : [new TextRun({ text: '', font: build.font.docx.body, size })],
    spacing: { ...lineSpacing(build), before: 60, after: 120 },
    indent: baseIndent(ctx),
    border: ctx.blockquote
      ? { left: { style: BorderStyle.SINGLE, size: 18, color: HEX(build.theme.accent), space: 8 } }
      : undefined,
    shading: ctx.blockquote
      ? { type: ShadingType.CLEAR, fill: HEX(build.theme.codeBg) }
      : undefined,
    ...(applyBullet && topFrame
      ? topFrame.ordered
        ? { numbering: { reference: topFrame.numRef!, level: Math.max(0, ctx.listStack.length - 1) } }
        : { bullet: { level: Math.max(0, ctx.listStack.length - 1) } }
      : {}),
  })
}

function hrParagraph(build: BuildCtx): Paragraph {
  return new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: HEX(build.theme.border), space: 1 } },
    spacing: { before: 200, after: 200 },
  })
}

function codeBlockParagraphs(content: string, build: BuildCtx): Paragraph[] {
  const lines = content.replace(/\n$/, '').split('\n')
  const size = hexPt(Math.max(build.baseSize * 0.85, 8))
  return lines.map(
    (line, idx) =>
      new Paragraph({
        children: [
          new TextRun({ text: line.length > 0 ? line : ' ', font: build.font.docx.mono, size, color: HEX(build.theme.codeText) }),
        ],
        shading: { type: ShadingType.CLEAR, fill: HEX(build.theme.codeBg) },
        spacing: { before: idx === 0 ? 120 : 0, after: idx === lines.length - 1 ? 120 : 0, line: 260, lineRule: 'auto' },
        keepLines: true,
      }),
  )
}

interface RunBaseProps {
  font: string
  size: number
  color: string
  bold?: boolean
  italic?: boolean
  images?: Map<string, ImageAsset>
}

function runsFromInline(children: Token[], base: RunBaseProps): (TextRun | ExternalHyperlink | ImageRun)[] {
  const out: (TextRun | ExternalHyperlink | ImageRun)[] = []
  let bold = Boolean(base.bold)
  let italic = Boolean(base.italic)
  let strike = false
  let linkHref: string | null = null
  let linkBuffer: TextRun[] = []

  const push = (run: TextRun) => {
    if (linkHref !== null) linkBuffer.push(run)
    else out.push(run)
  }

  const flushLink = () => {
    if (linkHref !== null) {
      out.push(new ExternalHyperlink({ link: linkHref, children: linkBuffer }))
      linkHref = null
      linkBuffer = []
    }
  }

  for (const token of children) {
    switch (token.type) {
      case 'text':
        if (token.content) push(new TextRun({ text: token.content, font: base.font, size: base.size, color: base.color, bold, italics: italic, strike }))
        break
      case 'softbreak':
      case 'hardbreak':
        push(new TextRun({ text: '', break: 1, font: base.font, size: base.size }))
        break
      case 'strong_open':
        bold = true
        break
      case 'strong_close':
        bold = Boolean(base.bold)
        break
      case 'em_open':
        italic = true
        break
      case 'em_close':
        italic = Boolean(base.italic)
        break
      case 's_open':
        strike = true
        break
      case 's_close':
        strike = false
        break
      case 'code_inline':
        push(
          new TextRun({
            text: token.content,
            font: base.font,
            size: base.size,
            bold,
            italics: italic,
            shading: { type: ShadingType.CLEAR, fill: 'F0F0F0' },
          }),
        )
        break
      case 'link_open':
        flushLink()
        linkHref = String(token.attrGet('href') ?? '#')
        break
      case 'link_close':
        flushLink()
        break
      case 'image': {
        const src = String(token.attrGet('src') ?? '')
        const asset = base.images?.get(src)
        if (asset) {
          flushLink()
          out.push(
            new ImageRun({
              type: asset.type,
              data: asset.data,
              transformation: { width: asset.width, height: asset.height },
              altText: { title: token.content || 'imagen', description: token.content || 'imagen', name: 'image' },
            }),
          )
        } else {
          push(new TextRun({ text: `[${token.content || 'imagen'}]`, font: base.font, size: base.size, italics: true }))
        }
        break
      }
      default:
        break
    }
  }
  flushLink()
  return out
}

function convertTable(tokens: Token[], cursor: Cursor, build: BuildCtx): Table {
  const rows: TableRow[] = []
  let inHead = false

  while (cursor.i < tokens.length) {
    const t = tokens[cursor.i]
    if (t.type === 'table_close') {
      cursor.i++
      break
    }
    if (t.type === 'thead_open') {
      inHead = true
      cursor.i++
      continue
    }
    if (t.type === 'thead_close') {
      inHead = false
      cursor.i++
      continue
    }
    if (t.type === 'tbody_open' || t.type === 'tbody_close') {
      cursor.i++
      continue
    }
    if (t.type === 'tr_open') {
      cursor.i++
      const cells: TableCell[] = []
      while (tokens[cursor.i].type !== 'tr_close') {
        const cellToken = tokens[cursor.i]
        if (cellToken.type === 'th_open' || cellToken.type === 'td_open') {
          cursor.i++
          const inline = tokens[cursor.i]
          cursor.i += 2 // inline + close
          const size = hexPt(Math.max(build.baseSize * 0.95, 8))
          const runs = runsFromInline(inline?.children ?? [], {
            font: build.font.docx.body,
            size,
            color: inHead ? HEX(build.theme.heading) : build.safeText,
            bold: inHead,
          })
          cells.push(
            new TableCell({
              width: { size: 100 / Math.max(1, countCells(tokens, cursor.i)), type: WidthType.PERCENTAGE },
              shading: inHead ? { type: ShadingType.CLEAR, fill: HEX(build.theme.tableHeadBg) } : undefined,
              margins: { top: 80, bottom: 80, left: 100, right: 100 },
              children: [new Paragraph({ children: runs })],
            }),
          )
        } else {
          cursor.i++
        }
      }
      cursor.i++ // tr_close
      rows.push(new TableRow({ children: cells }))
      continue
    }
    cursor.i++
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows,
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border) },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border) },
      left: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border) },
      right: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border) },
      insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border) },
      insideVertical: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border) },
    },
  })
}

function countCells(tokens: Token[], fromIdx: number): number {
  let count = 0
  let i = fromIdx
  let depth = 0
  while (i < tokens.length) {
    const t = tokens[i]
    if (t.type === 'tr_close' && depth === 0) break
    if (t.type === 'th_open' || t.type === 'td_open') count++
    i++
  }
  return Math.max(count, 1)
}

async function preloadImages(tokens: Token[]): Promise<Map<string, ImageAsset>> {
  const srcs = new Set<string>()
  collectImageSrcs(tokens, srcs)

  const map = new Map<string, ImageAsset>()
  await Promise.all(
    [...srcs].map(async (src) => {
      try {
        const asset = await loadImageAsset(src)
        if (asset) map.set(src, asset)
      } catch {
        /* skip broken images */
      }
    }),
  )
  return map
}

function collectImageSrcs(tokens: Token[], out: Set<string>) {
  for (const t of tokens) {
    if (t.type === 'inline' && t.children) collectImageSrcs(t.children, out)
    if (t.type === 'image') {
      const src = t.attrGet('src')
      if (src) out.add(String(src))
    }
  }
}

async function loadImageAsset(src: string): Promise<ImageAsset | null> {
  if (!/^(https?:|data:)/i.test(src)) return null
  const res = await fetch(src)
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const type = sniffImageType(bytes)
  if (!type) return null
  const { width, height } = await readImageDimensions(buf, res.headers.get('content-type') ?? undefined)
  const maxW = 500
  const scale = width > maxW ? maxW / width : 1
  return { data: bytes, type, width: Math.round(width * scale), height: Math.round(height * scale) }
}

function sniffImageType(bytes: Uint8Array): ImageAsset['type'] | null {
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'png'
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'jpg'
  if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'gif'
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return 'bmp'
  return null
}

function readImageDimensions(buf: ArrayBuffer, mime?: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const blob = new Blob([buf], { type: mime })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve({ width: img.naturalWidth || 300, height: img.naturalHeight || 200 })
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({ width: 300, height: 200 })
    }
    img.src = url
  })
}
