import * as pdfjs from 'pdfjs-dist'
import type { PDFPageProxy } from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { createWorker, PSM } from 'tesseract.js'
import { decodeFlyerData } from '@/lib/flyerEmbed'
import { FLYER_THEMES } from '@/lib/themes'
import { INITIAL_FLYER_DATA, type FlyerData } from '@/lib/utils'
import { parseFlyerLines, type ParseHints } from './parse'
import {
  makeLine,
  PAGE_WIDTH_CSS,
  type FlyerImportResult,
  type ImportProgress,
  type ImportSource,
  type TextLine,
  type TextWord,
} from './types'

export type { FlyerImportResult, ImportProgress } from './types'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

/** Render pages at 3× CSS resolution: ~40px-tall 10pt text works well for OCR */
const RENDER_WIDTH = PAGE_WIDTH_CSS * 3
/** Flyers are at most two pages; ignore anything past this */
const MAX_PAGES = 4
/** Below this many words the PDF has no usable text layer (image export) */
const MIN_TEXT_WORDS = 20
const MIN_OCR_CONFIDENCE = 40

type Rect = { x0: number; y0: number; x1: number; y1: number }
type ProgressFn = (p: ImportProgress) => void

export async function importFlyerFile(
  file: File,
  onProgress: ProgressFn = () => {}
): Promise<FlyerImportResult> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name)
  if (isPdf) return importPdf(file, onProgress)
  if (file.type.startsWith('image/')) {
    onProgress({ message: 'Loading image…' })
    const canvas = await imageToCanvas(file)
    return importFromCanvases([canvas], null, onProgress)
  }
  throw new Error('Please upload a PDF or an image of the flyer.')
}

async function importPdf(file: File, onProgress: ProgressFn): Promise<FlyerImportResult> {
  onProgress({ message: 'Opening PDF…' })
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
  }).promise

  try {
    // 1) Flyers downloaded from this app (after this feature) carry their data
    const { info } = await doc.getMetadata()
    const keywords = (info as Record<string, unknown> | undefined)?.Keywords
    const embedded = decodeFlyerData(typeof keywords === 'string' ? keywords : null)
    if (embedded) return buildResult(embedded, 'embedded', [])

    const pageCount = Math.min(doc.numPages, MAX_PAGES)
    const pages: PDFPageProxy[] = []
    for (let i = 1; i <= pageCount; i++) pages.push(await doc.getPage(i))

    // 2) "Print → Save as PDF" copies have a real text layer
    const textLines: TextLine[] = []
    for (let i = 0; i < pages.length; i++) {
      textLines.push(...(await readTextLayer(pages[i], i)))
    }
    const wordCount = textLines.reduce((n, l) => n + l.words.length, 0)

    onProgress({ message: 'Rendering pages…' })
    if (wordCount >= MIN_TEXT_WORDS) {
      const firstPage = await renderPage(pages[0])
      return importFromCanvases([firstPage], textLines, onProgress)
    }

    // 3) Older downloads are flat images — OCR them
    const canvases: HTMLCanvasElement[] = []
    for (const page of pages) canvases.push(await renderPage(page))
    return importFromCanvases(canvases, null, onProgress)
  } finally {
    void doc.destroy()
  }
}

async function importFromCanvases(
  canvases: HTMLCanvasElement[],
  textLines: TextLine[] | null,
  onProgress: ProgressFn
): Promise<FlyerImportResult> {
  const photo = extractPhoto(canvases[0])
  const hints: ParseHints = {
    theme: detectTheme(canvases[0]),
    profilePhotoUrl: photo?.dataUrl,
    compactMode: photo?.compact,
  }

  const lines = textLines ?? (await ocrCanvases(canvases, photo?.rect ?? null, onProgress))
  onProgress({ message: 'Filling in the form…', fraction: 1 })
  const { data, warnings } = parseFlyerLines(lines, hints)
  return buildResult(data, textLines ? 'text' : 'ocr', warnings)
}

function buildResult(
  data: FlyerData,
  source: ImportSource,
  warnings: string[]
): FlyerImportResult {
  const ignored = new Set<keyof FlyerData>(['theme', 'compactMode', 'sectionOrder'])
  const filledFields = (Object.keys(INITIAL_FLYER_DATA) as (keyof FlyerData)[]).filter(
    (key) =>
      !ignored.has(key) &&
      JSON.stringify(data[key]) !== JSON.stringify(INITIAL_FLYER_DATA[key])
  )
  return { data, source, filledFields, warnings }
}

// ---------------------------------------------------------------------------
// PDF text layer
// ---------------------------------------------------------------------------

async function readTextLayer(page: PDFPageProxy, pageIndex: number): Promise<TextLine[]> {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: PAGE_WIDTH_CSS / base.width })
  const content = await page.getTextContent()
  const words: TextWord[] = []

  for (const item of content.items) {
    if (!('str' in item) || !item.str.trim()) continue
    const tx = pdfjs.Util.transform(viewport.transform, item.transform)
    const fontHeight = Math.hypot(tx[2], tx[3])
    const width = item.width * viewport.scale
    const top = tx[5] - fontHeight * 0.8
    const bottom = tx[5] + fontHeight * 0.2
    const charWidth = width / item.str.length

    // Split runs into words, placing each by its character offset
    for (const m of item.str.matchAll(/\S+/g)) {
      const start = tx[4] + (m.index ?? 0) * charWidth
      words.push({
        text: m[0],
        x0: start,
        x1: start + m[0].length * charWidth,
        y0: top,
        y1: bottom,
      })
    }
  }

  return groupIntoLines(words, pageIndex)
}

function groupIntoLines(words: TextWord[], page: number): TextLine[] {
  const rows: { words: TextWord[]; cy: number; h: number }[] = []
  const sorted = [...words].sort((a, b) => (a.y0 + a.y1) / 2 - (b.y0 + b.y1) / 2)

  for (const w of sorted) {
    const cy = (w.y0 + w.y1) / 2
    const h = w.y1 - w.y0
    const row = rows.find((r) => Math.abs(r.cy - cy) < 0.5 * Math.min(r.h, h))
    if (row) row.words.push(w)
    else rows.push({ words: [w], cy, h })
  }

  return rows.map((r) => makeLine(page, mergeFragments(r.words)))
}

/** Text runs can split a word in two; glue pieces that touch. */
function mergeFragments(words: TextWord[]): TextWord[] {
  const sorted = [...words].sort((a, b) => a.x0 - b.x0)
  const out: TextWord[] = []
  for (const w of sorted) {
    const last = out[out.length - 1]
    if (last && w.x0 - last.x1 < 0.8) {
      out[out.length - 1] = {
        text: last.text + w.text,
        x0: last.x0,
        x1: w.x1,
        y0: Math.min(last.y0, w.y0),
        y1: Math.max(last.y1, w.y1),
      }
    } else {
      out.push(w)
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Rendering + OCR
// ---------------------------------------------------------------------------

async function renderPage(page: PDFPageProxy): Promise<HTMLCanvasElement> {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  await page.render({ canvasContext: ctx, canvas, viewport } as Parameters<
    PDFPageProxy['render']
  >[0]).promise
  return canvas
}

async function imageToCanvas(file: File): Promise<HTMLCanvasElement> {
  const bitmap = await createImageBitmap(file)
  const scale = RENDER_WIDTH / bitmap.width
  const canvas = document.createElement('canvas')
  canvas.width = RENDER_WIDTH
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas
}

/**
 * Flyer headings use light accent colors (e.g. peach #E1A185) that a plain
 * grayscale threshold drops. Use the darkest channel so colored ink stays dark
 * while the pastel paper and section backgrounds turn white.
 */
function prepareForOcr(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = source.width
  canvas.height = source.height
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(source, 0, 0)
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = img.data
  for (let i = 0; i < px.length; i += 4) {
    const v = Math.min(px[i], px[i + 1], px[i + 2])
    const out = v >= 200 ? 255 : Math.max(0, ((v - 100) * 255) / 100)
    px[i] = px[i + 1] = px[i + 2] = out
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

async function ocrCanvases(
  canvases: HTMLCanvasElement[],
  photoRect: Rect | null,
  onProgress: ProgressFn
): Promise<TextLine[]> {
  let pageIndex = 0
  onProgress({ message: 'Loading text recognition…', fraction: 0 })
  const worker = await createWorker('eng', 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        onProgress({
          message: `Reading page ${pageIndex + 1} of ${canvases.length}…`,
          fraction: (pageIndex + m.progress) / canvases.length,
        })
      }
    },
  })

  try {
    // The flyer is a single column of full-width boxes
    await worker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_COLUMN })
    const lines: TextLine[] = []

    for (; pageIndex < canvases.length; pageIndex++) {
      const canvas = canvases[pageIndex]
      const scale = PAGE_WIDTH_CSS / canvas.width
      const { data } = await worker.recognize(prepareForOcr(canvas), {}, { blocks: true })

      for (const block of data.blocks ?? []) {
        for (const paragraph of block.paragraphs) {
          for (const line of paragraph.lines) {
            const words = line.words
              .filter((w) => w.text.trim() && w.confidence >= MIN_OCR_CONFIDENCE)
              .map((w) => ({
                text: w.text.trim(),
                x0: w.bbox.x0 * scale,
                y0: w.bbox.y0 * scale,
                x1: w.bbox.x1 * scale,
                y1: w.bbox.y1 * scale,
              }))
              .filter((w) => pageIndex > 0 || !photoRect || !overlaps(w, photoRect))
            if (words.length) lines.push(makeLine(pageIndex, words))
          }
        }
      }
    }
    return lines
  } finally {
    await worker.terminate()
  }
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0
}

// ---------------------------------------------------------------------------
// Theme + profile photo recovery (geometry mirrors index.css)
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Match the page margin color against each theme's paper color. */
function detectTheme(canvas: HTMLCanvasElement): FlyerData['theme'] | undefined {
  const scale = canvas.width / PAGE_WIDTH_CSS
  const size = Math.max(1, Math.round(12 * scale))
  const px = canvas
    .getContext('2d')!
    .getImageData(Math.round(6 * scale), Math.round(6 * scale), size, size).data
  const avg = [0, 0, 0]
  for (let i = 0; i < px.length; i += 4) {
    avg[0] += px[i]
    avg[1] += px[i + 1]
    avg[2] += px[i + 2]
  }
  const count = px.length / 4
  const color = avg.map((v) => v / count)

  let best: FlyerData['theme'] | undefined
  let bestDist = 24
  for (const theme of FLYER_THEMES) {
    const paper = hexToRgb(theme.preview[0])
    const dist = Math.hypot(...paper.map((c, i) => c - color[i]))
    if (dist < bestDist) {
      best = theme.id
      bestDist = dist
    }
  }
  return best
}

const PHOTO_LAYOUTS = [
  // .flyer-header-photo: 1.15in square, header has 1px border + 12px/16px padding
  { compact: false, size: 110.4, left: 816 - 28.8 - 17 - 110.4, top: 28.8 + 13 },
  // Compact mode: 0.95in square, header padding 8px/12px
  { compact: true, size: 91.2, left: 816 - 28.8 - 13 - 91.2, top: 28.8 + 9 },
]

/**
 * Look for the bordered photo where the header puts it: a non-white edge at
 * the expected left border with plain header background just outside it.
 */
function extractPhoto(
  canvas: HTMLCanvasElement
): { dataUrl: string; rect: Rect; compact: boolean } | null {
  const scale = canvas.width / PAGE_WIDTH_CSS
  const ctx = canvas.getContext('2d')!
  const isWhite = (d: Uint8ClampedArray, i: number) =>
    d[i] > 235 && d[i + 1] > 235 && d[i + 2] > 235

  let best: { layout: (typeof PHOTO_LAYOUTS)[number]; score: number } | null = null
  for (const layout of PHOTO_LAYOUTS) {
    const x = Math.round((layout.left - 4) * scale)
    const w = Math.round(7 * scale)
    const y = Math.round((layout.top + 6) * scale)
    const h = Math.round((layout.size - 12) * scale)
    const d = ctx.getImageData(x, y, w, h).data
    let hits = 0
    for (let row = 0; row < h; row++) {
      const outside = row * w * 4
      let edge = false
      for (let col = Math.round(3 * scale); col < w; col++) {
        if (!isWhite(d, (row * w + col) * 4)) {
          edge = true
          break
        }
      }
      if (isWhite(d, outside) && edge) hits++
    }
    const score = hits / h
    if (!best || score > best.score) best = { layout, score }
  }

  if (!best || best.score < 0.8) return null
  const { layout } = best
  const rect = {
    x0: layout.left,
    y0: layout.top,
    x1: layout.left + layout.size,
    y1: layout.top + layout.size,
  }

  // Crop inside the 1px border
  const out = document.createElement('canvas')
  const side = Math.round((layout.size - 2) * scale)
  out.width = side
  out.height = side
  out
    .getContext('2d')!
    .drawImage(
      canvas,
      Math.round((layout.left + 1) * scale),
      Math.round((layout.top + 1) * scale),
      side,
      side,
      0,
      0,
      side,
      side
    )
  return { dataUrl: out.toDataURL('image/jpeg', 0.9), rect, compact: layout.compact }
}
