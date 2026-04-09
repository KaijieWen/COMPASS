import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

interface ExportOptions {
  filename?: string
  quality?: number
}

export async function exportToPdf(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'patient-flyer.pdf', quality = 2 } = options

  const pages = element.querySelectorAll('.flyer-page')
  
  if (pages.length === 0) {
    console.error('No flyer pages found')
    return
  }

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  })

  const pageWidth = 8.5
  const pageHeight = 11

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i] as HTMLElement

    const canvas = await html2canvas(page, {
      scale: quality,
      useCORS: true,
      logging: false,
      backgroundColor: null,
      windowWidth: page.scrollWidth,
      windowHeight: page.scrollHeight,
    })

    const imgWidth = pageWidth
    const imgHeight = (canvas.height * pageWidth) / canvas.width

    if (i > 0) {
      pdf.addPage()
    }

    // No offset - start at top left corner for printer-ready output
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight))
  }

  pdf.save(filename)
}

export async function exportSinglePageToPdf(
  element: HTMLElement,
  options: ExportOptions = {}
): Promise<void> {
  const { filename = 'patient-flyer.pdf', quality = 2 } = options

  // Capture the entire element as a canvas
  const canvas = await html2canvas(element, {
    scale: quality,
    useCORS: true,
    logging: false,
    backgroundColor: null,
  })

  // Create PDF with letter size
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'in',
    format: 'letter',
  })

  const pageWidth = 8.5
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  // Add the image
  const imgData = canvas.toDataURL('image/jpeg', 0.95)
  pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight)

  pdf.save(filename)
}
