import { fileToDataUrl } from './headerFooter'

/** Content images (inserted in the body/cover) can be shown fairly large (full
 *  page width) — a higher cap than logos/watermark, but still nowhere near a
 *  raw phone-camera photo. Shared by EditorToolbar.tsx and PreviewPane.tsx's
 *  drop/paste handlers, which insert into the same editable regions. */
export const CONTENT_IMAGE_MAX_DIMENSION = 1800

export interface OptimizeImageOptions {
  /** Longest side is capped to this many pixels — never upscaled. */
  maxDimension: number
  /** JPEG quality (0-1) for formats without transparency. */
  quality?: number
}

// Everything embeds as a data URL (nothing ever leaves the browser), so an
// unoptimized photo straight off a phone can make a single document tens of
// megabytes. Downscaling to a sane display size and re-encoding is the
// biggest lever — format choice matters less once the pixel count is sane.
const PRESERVE_TRANSPARENCY_TYPES = new Set(['image/png', 'image/gif'])

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('No se pudo leer la imagen'))
    img.src = src
  })
}

/**
 * Reads an uploaded/dropped/pasted image file and returns an optimized data
 * URL: downscaled to `maxDimension` on its longest side (if bigger) and
 * re-encoded as JPEG (or kept as PNG when the source format can carry
 * transparency, e.g. a logo on a transparent background).
 */
export async function optimizeImageFile(file: File, { maxDimension, quality = 0.82 }: OptimizeImageOptions): Promise<string> {
  // Vector art doesn't benefit from rasterizing/downscaling.
  if (file.type === 'image/svg+xml') return fileToDataUrl(file)

  const dataUrl = await fileToDataUrl(file)

  let img: HTMLImageElement
  try {
    img = await loadImage(dataUrl)
  } catch {
    return dataUrl
  }

  const longestSide = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = Math.min(1, maxDimension / longestSide)
  const preserveTransparency = PRESERVE_TRANSPARENCY_TYPES.has(file.type)

  // Already small enough, and re-encoding a PNG at the same size wouldn't
  // shrink it (it's lossless either way) — not worth the extra work/quality risk.
  if (scale === 1 && preserveTransparency) return dataUrl

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  return preserveTransparency ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality)
}
