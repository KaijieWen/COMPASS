import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  getSectionLabel,
  type LayoutIssue,
} from '@/lib/flyerLayout'
import { encodeFlyerData } from '@/lib/flyerEmbed'
import type { FlyerData } from '@/lib/utils'

interface ExportOptions {
  filename?: string
  quality?: number
  /** Embedded in the PDF so the flyer can be re-imported exactly later */
  data?: FlyerData
}

export class FlyerLayoutError extends Error {
  issues: LayoutIssue[]

  constructor(issues: LayoutIssue[]) {
    super('Flyer content overflows the page layout.')
    this.name = 'FlyerLayoutError'
    this.issues = issues
  }
}

/**
 * Detect sections that overflow their page under export geometry.
 */
export function detectPageOverflow(element: HTMLElement): LayoutIssue[] {
  const pages = Array.from(element.querySelectorAll<HTMLElement>('.flyer-page'))
  if (!pages.length) return []

  const originalPageStyles = pages.map((page) => ({
    height: page.style.height,
    minHeight: page.style.minHeight,
    overflow: page.style.overflow,
  }))

  pages.forEach((page) => {
    page.style.height = '11in'
    page.style.minHeight = '11in'
    page.style.overflow = 'hidden'
  })

  try {
    const issues: LayoutIssue[] = []

    pages.forEach((page, pageIndex) => {
      if (page.scrollHeight <= page.clientHeight + 1) return

      const sections = Array.from(
        page.querySelectorAll<HTMLElement>('[data-section-id]')
      )

      let cumulativeBottom = 0
      const pageTop = page.getBoundingClientRect().top

      for (const section of sections) {
        const rect = section.getBoundingClientRect()
        const sectionTop = rect.top - pageTop
        const sectionBottom = sectionTop + rect.height

        if (sectionBottom > page.clientHeight) {
          const sectionId = section.dataset.sectionId
          if (sectionId) {
            issues.push({
              type: 'page_overflow',
              sectionId,
              sectionLabel: getSectionLabel(sectionId),
              pageIndex,
              message: `Content in "${getSectionLabel(sectionId)}" will be cut off on page ${pageIndex + 1}.`,
            })
          }
        }

        cumulativeBottom = Math.max(cumulativeBottom, sectionBottom)
      }

      if (cumulativeBottom > page.clientHeight && sections.length === 0) {
        issues.push({
          type: 'page_overflow',
          pageIndex,
          message: `Page ${pageIndex + 1} content exceeds the printable area.`,
        })
      }
    })

    const seen = new Set<string>()
    return issues.filter((issue) => {
      const key = `${issue.type}:${issue.sectionId ?? ''}:${issue.pageIndex ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  } finally {
    pages.forEach((page, i) => {
      page.style.height = originalPageStyles[i].height
      page.style.minHeight = originalPageStyles[i].minHeight
      page.style.overflow = originalPageStyles[i].overflow
    })
  }
}

/**
 * Capture each flyer page as a canvas and export as a letter-size PDF.
 */
export async function exportToPdf(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'patient-flyer.pdf', quality = 2, data } = options

  const overflowIssues = detectPageOverflow(element)
  if (overflowIssues.length > 0) {
    throw new FlyerLayoutError(overflowIssues)
  }

  const hidden = Array.from(
    element.querySelectorAll<HTMLElement>('[data-export-hide="true"]')
  )
  const previousVisibility = hidden.map((el) => el.style.visibility)
  hidden.forEach((el) => {
    el.style.visibility = 'hidden'
  })

  const pages = Array.from(element.querySelectorAll<HTMLElement>('.flyer-page'))
  if (!pages.length) {
    throw new Error('No flyer pages found for export.')
  }

  const originalPageStyles = pages.map((page) => ({
    height: page.style.height,
    minHeight: page.style.minHeight,
    overflow: page.style.overflow,
  }))

  pages.forEach((page) => {
    page.style.height = '11in'
    page.style.minHeight = '11in'
    page.style.overflow = 'hidden'
  })

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'in',
      format: 'letter',
    })

    if (data) {
      pdf.setDocumentProperties({
        title: data.preferredName.trim()
          ? `Patient Flyer – ${data.preferredName.trim()}`
          : 'Patient Flyer',
        creator: 'Patient Flyer',
        keywords: encodeFlyerData(data),
      })
    }

    const pageWidthIn = 8.5
    const pageHeightIn = 11

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const canvas = await html2canvas(page, {
        scale: quality,
        useCORS: true,
        logging: false,
        backgroundColor: null,
        windowWidth: page.scrollWidth,
        windowHeight: page.scrollHeight,
      })

      if (i > 0) {
        pdf.addPage()
      }

      const imgHeightIn = Math.min(
        pageHeightIn,
        (canvas.height * pageWidthIn) / canvas.width
      )
      pdf.addImage(
        canvas.toDataURL('image/jpeg', 0.95),
        'JPEG',
        0,
        0,
        pageWidthIn,
        imgHeightIn
      )
    }

    pdf.save(filename)
  } finally {
    pages.forEach((page, i) => {
      page.style.height = originalPageStyles[i].height
      page.style.minHeight = originalPageStyles[i].minHeight
      page.style.overflow = originalPageStyles[i].overflow
    })
    hidden.forEach((el, i) => {
      el.style.visibility = previousVisibility[i]
    })
  }
}
