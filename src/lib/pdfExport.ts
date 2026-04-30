import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface ExportOptions {
  filename?: string
  quality?: number
}

/**
 * Capture the flyer element as a tall canvas and slice it into letter-size PDF pages.
 * This handles arbitrary content lengths (e.g. after drag-and-drop reorder) without
 * relying on a fixed multi-page DOM structure.
 */
export async function exportToPdf(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'patient-flyer.pdf', quality = 2 } = options

  // Hide any UI-only elements (e.g. drag handles) during capture.
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

  // Keep original inline styles so we can restore after export.
  const originalPageStyles = pages.map((page) => ({
    height: page.style.height,
    minHeight: page.style.minHeight,
    overflow: page.style.overflow,
  }))

  // During export, normalize page geometry for consistent output.
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

      // Fit image to page width and cap to page height.
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
