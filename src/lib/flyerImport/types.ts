import type { FlyerData } from '@/lib/utils'

/**
 * All coordinates are normalized to CSS pixels of an 8.5in-wide flyer page
 * (816px), so layout heuristics work the same for OCR and PDF text layers.
 */
export const PAGE_WIDTH_CSS = 816

export interface TextWord {
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export interface TextLine {
  page: number
  words: TextWord[]
  text: string
  x0: number
  y0: number
  x1: number
  y1: number
}

export type ImportSource = 'embedded' | 'text' | 'ocr'

export interface FlyerImportResult {
  data: FlyerData
  source: ImportSource
  /** Form fields that received a value from the uploaded flyer */
  filledFields: (keyof FlyerData)[]
  warnings: string[]
}

export interface ImportProgress {
  message: string
  /** 0..1 when known */
  fraction?: number
}

export function makeLine(page: number, words: TextWord[]): TextLine {
  const sorted = [...words].sort((a, b) => a.x0 - b.x0)
  return {
    page,
    words: sorted,
    text: sorted.map((w) => w.text).join(' '),
    x0: Math.min(...sorted.map((w) => w.x0)),
    y0: Math.min(...sorted.map((w) => w.y0)),
    x1: Math.max(...sorted.map((w) => w.x1)),
    y1: Math.max(...sorted.map((w) => w.y1)),
  }
}
