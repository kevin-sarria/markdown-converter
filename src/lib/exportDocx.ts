import {
  AlignmentType,
  BorderStyle,
  convertMillimetersToTwip,
  Document,
  ExternalHyperlink,
  Footer,
  FrameAnchorType,
  Header,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
  type IFrameOptions,
  type ILevelsOptions,
} from 'docx'
import { saveAs } from 'file-saver'
import type { Token } from 'markdown-it'
import { hasCoverContent } from './coverPage'
import { buildFooter, buildHeader } from './docxHeaderFooter'
import { parseImageWidthFragment } from './imageWidth'
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

/**
 * How wide the page's text column is, in the pixels docx uses for image
 * transformations. Images are capped to this so a big photo can't run off the
 * page — and to a column's share of it inside a columns row, since an image
 * scaled for the full width would spill straight out of a 40% cell.
 */
const DOCX_CONTENT_WIDTH_PX = 500

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

  const buildCtx: BuildCtx = {
    theme,
    font,
    baseSize: settings.fontSizePt,
    lineHeight: settings.lineHeight,
    numberingConfigs,
    images,
    imageMaxWidthPx: DOCX_CONTENT_WIDTH_PX,
    page: { widthMm: page.widthMm, heightMm: page.heightMm, marginMm: margin.mm },
    safeHeading,
    safeText,
  }

  const body = convertBlocks(tokens, cursor, null, ctx, buildCtx)

  const hf = settings.headerFooter
  const header = await buildHeader(hf, settings.watermark, font)
  const footer = buildFooter(hf, font)

  // The cover is free-form Markdown too (see coverPage.ts) — converted with the
  // exact same convertBlocks/preloadImages the body uses, just against its own
  // text, followed by a hard page break. A cover page is always page 1 with a
  // blank header/footer of its own — the "show on first page" toggle then
  // refers to the first page of the body, which docx.js can't distinguish
  // separately from page 1 when there's no cover, so it stops applying once a
  // cover exists.
  const cover = settings.coverPage
  let coverBlocks: (Paragraph | Table)[] = []
  if (hasCoverContent(cover)) {
    const coverTokens = md.parse(cover.content, {})
    const coverImages = await preloadImages(coverTokens)
    coverBlocks = convertBlocks(coverTokens, { i: 0 }, null, { listStack: [], blockquote: false, bulletPending: null }, { ...buildCtx, images: coverImages })
    coverBlocks.push(new Paragraph({ children: [new PageBreak()] }))
  }
  const showFirstPageBand = coverBlocks.length > 0 || (hf.enabled && !hf.showOnFirstPage)

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
        children: [...coverBlocks, ...(body.length > 0 ? body : [new Paragraph({})])],
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
  /** How wide an image may be here — narrower inside a column. See DOCX_CONTENT_WIDTH_PX. */
  imageMaxWidthPx: number
  /** Inside a canvas item, images are drawn at exactly this width, the way the
   * preview draws them at 100% of the item's box. */
  imageExactWidthPx?: number
  /** The page this document is laid out on, for canvas positioning. */
  page: { widthMm: number; heightMm: number; marginMm: number }
  /** Pins every paragraph produced here to one spot on the page — set while
   * converting a canvas item, absent everywhere else. Paragraphs that share a
   * frame definition are a single frame to Word. */
  frame?: IFrameOptions
  /** The canvas box's own look, applied to everything inside it. Absent means
   * "follow the document", exactly as it does on screen. */
  boxStyle?: {
    sizePt: number | null
    color: string | null
    align: (typeof AlignmentType)[keyof typeof AlignmentType] | null
    font: string | null
  }
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
      case 'page_break': {
        out.push(new Paragraph({ children: [new PageBreak()] }))
        cursor.i++
        break
      }
      case 'table_open': {
        cursor.i++
        out.push(convertTable(tokens, cursor, build))
        break
      }
      case 'canvas_open': {
        cursor.i++
        out.push(...convertCanvasPage(tokens, cursor, ctx, build))
        break
      }
      case 'columns_open': {
        const align = String(t.attrGet('align') ?? 'arriba')
        cursor.i++
        out.push(convertColumnsRow(tokens, cursor, align, ctx, build))
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
  const box = build.boxStyle
  const scale = level === 1 ? 2.1 : level === 2 ? 1.6 : level === 3 ? 1.3 : level === 4 ? 1.1 : 1
  // A box that was given a size means that size, not that size times a heading
  // multiplier — on screen the box's font-size wins for the same reason.
  const size = hexPt(box?.sizePt ?? Math.round(build.baseSize * scale * 10) / 10)
  const runs = runsFromInline(inline?.children ?? [], {
    font: box?.font ?? build.font.docx.heading,
    size,
    color: box?.color ?? build.safeHeading,
    bold: true,
    images: build.images,
    maxImageWidthPx: build.imageMaxWidthPx,
    exactImageWidthPx: build.imageExactWidthPx,
  })
  return new Paragraph({
    frame: build.frame,
    alignment: box?.align ?? undefined,
    children: runs,
    spacing: { before: 320, after: 160 },
    border:
      level <= 2
        ? { bottom: { style: BorderStyle.SINGLE, size: 4, color: HEX(build.theme.border), space: 4 } }
        : undefined,
  })
}

function bodyParagraph(inline: Token, ctx: StyleCtx, build: BuildCtx): Paragraph {
  const box = build.boxStyle
  const size = hexPt(box?.sizePt ?? build.baseSize)
  const runs = runsFromInline(inline?.children ?? [], {
    font: box?.font ?? build.font.docx.body,
    size,
    color: box?.color ?? (ctx.blockquote ? HEX(build.theme.muted) : build.safeText),
    italic: ctx.blockquote,
    images: build.images,
    maxImageWidthPx: build.imageMaxWidthPx,
    exactImageWidthPx: build.imageExactWidthPx,
  })

  const topFrame = ctx.listStack[ctx.listStack.length - 1]
  const applyBullet = Boolean(topFrame && ctx.bulletPending?.value)
  if (applyBullet && ctx.bulletPending) ctx.bulletPending.value = false

  return new Paragraph({
    frame: build.frame,
    alignment: box?.align ?? undefined,
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
        frame: build.frame,
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
  /** Widest this image may be drawn — the column's share of the page. */
  maxImageWidthPx?: number
  /** Drawn at exactly this width instead, when the box decides the size. */
  exactImageWidthPx?: number
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
              transformation: fitWithin(asset, base.maxImageWidthPx, base.exactImageWidthPx),
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

/**
 * The size to draw an image at, keeping its ratio: exactly the width of the box
 * that holds it when there is one (a canvas item, where the box decides the
 * size), otherwise capped to the width available where it sits.
 */
function fitWithin(
  asset: ImageAsset,
  maxWidthPx: number | undefined,
  exactWidthPx?: number,
): { width: number; height: number } {
  const target = exactWidthPx ?? (maxWidthPx && asset.width > maxWidthPx ? maxWidthPx : null)
  if (target === null) return { width: asset.width, height: asset.height }

  const scale = target / asset.width
  return { width: Math.round(target), height: Math.round(asset.height * scale) }
}

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const

const CELL_VERTICAL_ALIGN = {
  arriba: VerticalAlign.TOP,
  centro: VerticalAlign.CENTER,
  abajo: VerticalAlign.BOTTOM,
} as const

/**
 * A `::: columnas` row (see columns.ts) as a borderless one-row Word table.
 *
 * Word has no flow-layout columns that work mid-document — a table with
 * invisible borders is how Word itself lays content out side by side, and it
 * keeps every cell's text editable there instead of flattening the row into a
 * picture.
 *
 * Each cell's content goes back through convertBlocks, so a list stays a list
 * and a quote stays a quote inside a column. The only thing that changes is the
 * image budget: an image sized for the full page would spill out of a narrow
 * cell, so each column passes down its own share.
 */
const CANVAS_ALIGNMENT = {
  izquierda: AlignmentType.LEFT,
  centro: AlignmentType.CENTER,
  derecha: AlignmentType.RIGHT,
} as const

/**
 * The box's own look, read off the same token attributes the browser renders
 * from (see canvasPlugin.ts), so Word and the screen agree by construction.
 */
function readBoxStyle(token: Token, build: BuildCtx): BuildCtx['boxStyle'] {
  const size = token.attrGet('size')
  const color = token.attrGet('color')
  const align = token.attrGet('align')
  const font = token.attrGet('font')

  const family =
    font === 'titulo'
      ? build.font.docx.heading
      : font === 'texto'
        ? build.font.docx.body
        : font === 'mono'
          ? build.font.docx.mono
          : null

  return {
    sizePt: size === null ? null : Number(size),
    // Word wants six hex digits with no hash; the value was already validated
    // as a hex colour when the document was parsed.
    color: color === null ? null : expandHex(String(color)),
    align: align === null ? null : (CANVAS_ALIGNMENT[String(align) as keyof typeof CANVAS_ALIGNMENT] ?? null),
    font: family,
  }
}

/** `#abc` and `#aabbcc` both become `AABBCC`. */
function expandHex(color: string): string {
  const hex = color.replace('#', '')
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
  return full.toUpperCase()
}

/** An item with no pinned height still needs one for a Word frame to exist. */
const DEFAULT_ITEM_HEIGHT_PERCENT = 12

/**
 * A `::: lienzo` page (see canvas.ts) as Word sees it: each item becomes a
 * paragraph pinned to an absolute spot on the page with a frame, and the page
 * is closed with a break so the next content starts fresh.
 *
 * A frame is the only construct in a Word document that says "this block goes
 * *here*", which is exactly what a canvas means. Positions arrive as
 * percentages of the page's content box, so they're turned into twips measured
 * from the page corner — the margin has to be added back, because the anchor is
 * the page itself and not the text area.
 *
 * The alternative was rasterizing the page into a picture. It would look
 * identical and be worthless: nobody could edit a word of it in Word, which is
 * the only reason to export to Word at all.
 */
function convertCanvasPage(
  tokens: Token[],
  cursor: Cursor,
  ctx: StyleCtx,
  build: BuildCtx,
): (Paragraph | Table)[] {
  const out: (Paragraph | Table)[] = []
  const { widthMm, heightMm, marginMm } = build.page
  const contentWidthMm = widthMm - marginMm * 2
  const contentHeightMm = heightMm - marginMm * 2

  while (cursor.i < tokens.length && tokens[cursor.i].type !== 'canvas_close') {
    const token = tokens[cursor.i]
    if (token.type !== 'canvas_item_open') {
      cursor.i++
      continue
    }

    const boxStyle = readBoxStyle(token, build)

    const percent = (name: string, fallback: number) => {
      const value = Number(token.attrGet(name))
      return Number.isFinite(value) ? value : fallback
    }
    const xPercent = percent('x', 0)
    const yPercent = percent('y', 0)
    const wPercent = percent('w', 100)
    const hPercent = token.attrGet('h') === null ? DEFAULT_ITEM_HEIGHT_PERCENT : percent('h', DEFAULT_ITEM_HEIGHT_PERCENT)

    const widthTwip = convertMillimetersToTwip((wPercent / 100) * contentWidthMm)
    const frame = {
      type: 'absolute' as const,
      position: {
        x: convertMillimetersToTwip(marginMm + (xPercent / 100) * contentWidthMm),
        y: convertMillimetersToTwip(marginMm + (yPercent / 100) * contentHeightMm),
      },
      width: widthTwip,
      height: convertMillimetersToTwip((hPercent / 100) * contentHeightMm),
      anchor: { horizontal: FrameAnchorType.PAGE, vertical: FrameAnchorType.PAGE },
    }

    cursor.i++
    // The frame travels down with the build context so every paragraph is born
    // pinned. docx exposes no way to add a frame to a Paragraph after the fact.
    out.push(
      ...convertBlocks(tokens, cursor, 'canvas_item_close', ctx, {
        ...build,
        frame,
        boxStyle,
        // The item's box decides how big its picture is, exactly as on screen.
        imageExactWidthPx: Math.round(((wPercent / 100) * contentWidthMm * 96) / 25.4),
      }),
    )
  }
  cursor.i++ // canvas_close

  // Close the page so whatever follows starts on a fresh one — unless nothing
  // follows, where the break would just be a blank sheet at the end.
  if (cursor.i < tokens.length) out.push(new Paragraph({ children: [new PageBreak()] }))
  return out
}

function convertColumnsRow(
  tokens: Token[],
  cursor: Cursor,
  align: string,
  ctx: StyleCtx,
  build: BuildCtx,
): Table {
  const cells: TableCell[] = []

  while (cursor.i < tokens.length && tokens[cursor.i].type !== 'columns_close') {
    const token = tokens[cursor.i]
    if (token.type !== 'columns_col_open') {
      cursor.i++
      continue
    }

    const widthPercent = Number(token.attrGet('width')) || 0
    cursor.i++

    const children = convertBlocks(tokens, cursor, 'columns_col_close', ctx, {
      ...build,
      imageMaxWidthPx: Math.round((DOCX_CONTENT_WIDTH_PX * widthPercent) / 100),
    })

    cells.push(
      new TableCell({
        width: { size: widthPercent, type: WidthType.PERCENTAGE },
        margins: { top: 0, bottom: 0, left: 60, right: 60 },
        verticalAlign: CELL_VERTICAL_ALIGN[align as keyof typeof CELL_VERTICAL_ALIGN] ?? VerticalAlign.TOP,
        // Word rejects a cell with no paragraph in it, and an emptied column is
        // a shape the editor can legitimately produce.
        children: children.length > 0 ? children : [new Paragraph({ text: '' })],
      }),
    )
  }
  cursor.i++ // columns_close

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [new TableRow({ children: cells })],
    borders: {
      top: NO_BORDER,
      bottom: NO_BORDER,
      left: NO_BORDER,
      right: NO_BORDER,
      insideHorizontal: NO_BORDER,
      insideVertical: NO_BORDER,
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

async function loadImageAsset(rawSrc: string): Promise<ImageAsset | null> {
  // Resized images carry their chosen width as a #w=NNN fragment (see
  // imageWidth.ts) — honor it here instead of the default cap so DOCX matches
  // what the user set in the editable preview.
  const { cleanSrc: src, widthPx } = parseImageWidthFragment(rawSrc)
  if (!/^(https?:|data:)/i.test(src)) return null
  const res = await fetch(src)
  if (!res.ok) return null
  const buf = await res.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const type = sniffImageType(bytes)
  if (!type) return null
  const { width, height } = await readImageDimensions(buf, res.headers.get('content-type') ?? undefined)
  const scale = widthPx
    ? widthPx / width
    : width > DOCX_CONTENT_WIDTH_PX
      ? DOCX_CONTENT_WIDTH_PX / width
      : 1
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
