import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import JSZip from 'jszip'

const TEMPLATE_URL = 'S-13_S.pdf'
const PAGE_HEIGHT = 842.04
const BODY_TOP = 146.4
const ROW_HEIGHT = 31.35
const MAX_ROWS = 20
const SLOTS_PER_ROW = 4
const SLOT_STARTS = [135.3, 242.0, 348.7, 455.4]

export function serviceYear(now = new Date(), offset = 0) {
  const year = now.getFullYear()
  const currentStartYear = now.getMonth() >= 8 ? year : year - 1
  const startYear = currentStartYear + offset
  return {
    label: `${startYear}-${startYear + 1}`,
    start: `${startYear}-09-01`,
    end: `${startYear + 1}-09-01`,
    previousStart: `${startYear - 1}-09-01`,
  }
}

function shortDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y.slice(-2)}`
}

function centerText(page, font, text, centerX, y, size) {
  const width = font.widthOfTextAtSize(text, size)
  page.drawText(text, { x: centerX - width / 2, y, size, font, color: rgb(0.12, 0.12, 0.12) })
}

export function rowsForTerritory(filas, territorio, sy) {
  const propias = filas.filter((r) => r.territorio === territorio && r.inicio && r.fin)
  const current = propias
    .filter((r) => r.fin >= sy.start && r.fin < sy.end)
    .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.fin.localeCompare(b.fin))
  const previous = propias
    .filter((r) => r.fin >= sy.previousStart && r.fin < sy.start)
    .sort((a, b) => b.fin.localeCompare(a.fin))[0]
  return { current, previous: previous ? previous.fin : '' }
}

async function createTerritoryPdf(templateBytes, fontBytes, territorio, filas, sy) {
  const template = await PDFDocument.load(templateBytes)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(fontBytes)
  const { current, previous } = rowsForTerritory(filas, territorio, sy)
  const capacity = MAX_ROWS * SLOTS_PER_ROW
  const pageCount = Math.max(1, Math.ceil(current.length / capacity))

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const [page] = await pdf.copyPages(template, [0])
    pdf.addPage(page)
    centerText(page, font, sy.label, 164, PAGE_HEIGHT - 96, 9)
    const pageRecords = current.slice(pageIndex * capacity, (pageIndex + 1) * capacity)
    const priorDate = pageIndex === 0 ? previous : current[pageIndex * capacity - 1].fin

    pageRecords.forEach((record, index) => {
      const row = Math.floor(index / SLOTS_PER_ROW)
      const slot = index % SLOTS_PER_ROW
      const top = BODY_TOP + row * ROW_HEIGHT
      const numberY = PAGE_HEIGHT - (top + 19.2)
      const dateY = PAGE_HEIGHT - (top + 26.2)

      // El número y la fecha anterior identifican cada fila usada. "Asignado a"
      // queda vacío porque el registro actual no contiene nombres.
      if (slot === 0) {
        centerText(page, font, territorio.replace(/^T/i, ''), 53.7, numberY, 8.5)
        if (priorDate) centerText(page, font, shortDate(priorDate), 103.6, numberY, 7.3)
      }

      const x = SLOT_STARTS[slot]
      centerText(page, font, shortDate(record.inicio), x + 26.7, dateY, 7.3)
      centerText(page, font, shortDate(record.fin), x + 80.0, dateY, 7.3)
    })
  }

  return pdf.save()
}

export async function generarS13Zip(filas, territorios, now = new Date(), yearOffset = 0) {
  const sy = serviceYear(now, yearOffset)
  const response = await fetch(TEMPLATE_URL)
  if (!response.ok) throw new Error('No se pudo cargar la plantilla S-13.')
  const templateBytes = await response.arrayBuffer()
  const fontBytes = StandardFonts.Helvetica
  // Orden numérico y un archivo aun cuando el territorio no tenga pasadas.
  const ids = [...territorios].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10))
  const zip = new JSZip()

  for (const territorio of ids) {
    // StandardFonts se pasa como nombre; cada documento lo incorpora por separado.
    const bytes = await createTerritoryPdf(templateBytes, fontBytes, territorio, filas, sy)
    zip.file(`S-13-${territorio}-${sy.label}.pdf`, bytes)
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
  return { blob, filename: `S-13-territorios-${sy.label}.zip`, year: sy.label }
}

export function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
