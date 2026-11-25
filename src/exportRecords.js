export function recordsExcelBlob(records) {
  const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const rows = records.slice().reverse().map((f) => `<Row><Cell><Data ss:Type="String">${esc(f.territorio)}</Data></Cell><Cell><Data ss:Type="String">${esc(f.inicio)}</Data></Cell><Cell><Data ss:Type="String">${esc(f.fin || '')}</Data></Cell><Cell><Data ss:Type="String">${f.campania ? 'C' : ''}</Data></Cell></Row>`).join('')
  const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Registros"><Table><Row><Cell><Data ss:Type="String">Territorio</Data></Cell><Cell><Data ss:Type="String">Inicio</Data></Cell><Cell><Data ss:Type="String">Fin</Data></Cell><Cell><Data ss:Type="String">Campaña</Data></Cell></Row>${rows}</Table></Worksheet></Workbook>`
  return new Blob([xml], { type: 'application/vnd.ms-excel' })
}

export function downloadRecordsExcel(records,date) {
  const url=URL.createObjectURL(recordsExcelBlob(records))
  const a=document.createElement('a');a.href=url;a.download=`territorios-${date}.xls`;a.click()
  setTimeout(()=>URL.revokeObjectURL(url),1000)
}
