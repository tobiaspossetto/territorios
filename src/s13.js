import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

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

// Convierte los registros en filas físicas del formulario. Cada territorio
// empieza una fila nueva y cada fila admite cuatro pasadas.
export function layoutS13Rows(filas, territorios, sy) {
  const ids = [...territorios].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10))
  return ids.flatMap((territorio) => {
    const { current, previous } = rowsForTerritory(filas, territorio, sy)
    if (!current.length) return [{ territorio, previous, records: [] }]
    const rows = []
    for (let i = 0; i < current.length; i += SLOTS_PER_ROW) {
      rows.push({ territorio, previous, records: current.slice(i, i + SLOTS_PER_ROW) })
    }
    return rows
  })
}

async function createCombinedPdf(templateBytes, fontBytes, filas, territorios, sy) {
  const template = await PDFDocument.load(templateBytes)
  const pdf = await PDFDocument.create()
  const font = await pdf.embedFont(fontBytes)
  const rows = layoutS13Rows(filas, territorios, sy)
  const pageCount = Math.max(1, Math.ceil(rows.length / MAX_ROWS))

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
    const [page] = await pdf.copyPages(template, [0])
    pdf.addPage(page)
    centerText(page, font, sy.label, 164, PAGE_HEIGHT - 96, 9)
    const pageRows = rows.slice(pageIndex * MAX_ROWS, (pageIndex + 1) * MAX_ROWS)

    pageRows.forEach(({ territorio, previous, records }, rowIndex) => {
      const top = BODY_TOP + rowIndex * ROW_HEIGHT
      const numberY = PAGE_HEIGHT - (top + 19.2)
      const dateY = PAGE_HEIGHT - (top + 26.2)

      centerText(page, font, territorio.replace(/^T/i, ''), 53.7, numberY, 8.5)
      if (previous) centerText(page, font, shortDate(previous), 103.6, numberY, 7.3)

      records.forEach((record, slot) => {
        const x = SLOT_STARTS[slot]
        centerText(page, font, shortDate(record.inicio), x + 26.7, dateY, 7.3)
        centerText(page, font, shortDate(record.fin), x + 80.0, dateY, 7.3)
      })
    })
  }

  return pdf.save()
}

export async function generarS13Pdf(filas, territorios, now = new Date(), yearOffset = 0) {
  const sy = serviceYear(now, yearOffset)
  const response = await fetch(TEMPLATE_URL)
  if (!response.ok) throw new Error('No se pudo cargar la plantilla S-13.')
  const templateBytes = await response.arrayBuffer()
  const fontBytes = StandardFonts.Helvetica
  const bytes = await createCombinedPdf(templateBytes, fontBytes, filas, territorios, sy)
  return {
    blob: new Blob([bytes], { type: 'application/pdf' }),
    filename: `S-13-territorios-${sy.label}.pdf`,
    year: sy.label,
  }
}

export function descargarBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
