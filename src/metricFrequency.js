import {localProgramDate, programDate} from './programDates.js'

export function metricServiceYear(now = new Date()) {
  const [year, month] = localProgramDate(now).split('-').map(Number)
  return month >= 9 ? year : year - 1
}

export function serviceCompletionCount(summary, now = new Date()) {
  // An existing yearly breakdown is authoritative, including absent (zero) years.
  if (summary.vecesPorAnoServicio && typeof summary.vecesPorAnoServicio === 'object') {
    return summary.vecesPorAnoServicio[String(metricServiceYear(now))] || 0
  }
  // Legacy cached counts have no year attached and cannot safely be reused.
  return 0
}

export function metricHistoryStart(feats, recordedStart) {
  return [programDate(recordedStart), ...feats.map(f => programDate(f.primera_inicio))].filter(Boolean).sort()[0] || null
}

export function territoryFrequency(territory, reference, now = new Date(), recordedStart) {
  return metricFrequency([{...territory, veces: reference === 'service' ? territory.veces_servicio : territory.veces}], reference, now, recordedStart)
}

export function metricFrequency(feats, reference, now = new Date(), recordedStart) {
  const counted = feats.filter(f => Number(f.veces) > 0)
  const pasadas = counted.reduce((sum, f) => sum + Number(f.veces), 0)
  const today = localProgramDate(now)
  if (!pasadas) return {days: null, reason: 'Sin finalizaciones en este período.'}
  const historicalStart = metricHistoryStart(feats, recordedStart)
  if (reference !== 'service' && (!historicalStart || historicalStart > today)) {
    return {days: null, reason: 'El historial antiguo no incluye la fecha de inicio necesaria para estimar el recorrido.'}
  }
  const start = reference === 'service' ? `${metricServiceYear(now)}-09-01` : historicalStart
  // Calendar days in Córdoba: no noon rounding or device-timezone dependence.
  const elapsed = Math.max(1, (Date.parse(today) - Date.parse(start)) / 86400000 + 1)
  return {days: Math.max(1, Math.round(feats.length * elapsed / pasadas)), start, elapsed, pasadas}
}
