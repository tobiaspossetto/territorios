// PoC LOCAL de "modo admin": simula lo que haría Firestore (login + escritura
// de registros) pero todo vive en localStorage, en este navegador nomás. Sirve
// para probar el flujo antes de migrar de verdad. Nada de esto pega a un
// backend real ni es seguro — es solo para decidir si el flujo convence.
//
// El registro completo (todas las filas reales del Excel: Territorio | Inicio
// | Fin | Campaña) se carga aparte desde public/registro.json — un export
// LOCAL que nunca se commitea (ver .gitignore), porque es justo el dato que
// se quiere mantener privado más adelante.
//
// overlay = {
//   filas: [ { id, territorio, inicio, fin, campania }, ... ]     // filas NUEVAS
//   ediciones: { "real-<i>": { inicio?, fin?, campania?, eliminado? } }
//     // cambios sobre una fila YA existente del registro real (i = índice en
//     // registroBase, estable durante la sesión). Cualquier fila, real o
//     // nueva, se puede editar o eliminar igual.
// }
// Sin Fin -> fila "activa" (en proceso, no cuenta en veces). Con Fin ->
// completada. Igual que en el Excel real.

const OVERLAY_KEY = 'admin_overlay_v1'
const SESSION_KEY = 'admin_session_v1'
const CAMPMODE_KEY = 'admin_campmode_v1'

export function checkLogin(user, pass) {
  return user.trim().toLowerCase() === 'tobi' && pass === '12345'
}

export function isAdminSession() {
  try { return localStorage.getItem(SESSION_KEY) === '1' } catch (e) { return false }
}
export function setAdminSession(on) {
  try { on ? localStorage.setItem(SESSION_KEY, '1') : localStorage.removeItem(SESSION_KEY) } catch (e) {}
}

// interruptor global: mientras esté apagado, nadie puede tocar la columna Campaña
export function isCampaniaModoActivo() {
  try { return localStorage.getItem(CAMPMODE_KEY) === '1' } catch (e) { return false }
}
export function setCampaniaModoActivo(on) {
  try { on ? localStorage.setItem(CAMPMODE_KEY, '1') : localStorage.removeItem(CAMPMODE_KEY) } catch (e) {}
}

export function todayISO() { return new Date().toISOString().slice(0, 10) }
export function fmtFecha(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

const emptyOverlay = () => ({ filas: [], ediciones: {} })

export function loadOverlay() {
  try {
    const raw = JSON.parse(localStorage.getItem(OVERLAY_KEY))
    if (!raw) return emptyOverlay()
    return { filas: raw.filas || [], ediciones: raw.ediciones || {} }
  } catch (e) { return emptyOverlay() }
}
function saveOverlay(ov) {
  try { localStorage.setItem(OVERLAY_KEY, JSON.stringify(ov)) } catch (e) {}
  return ov
}

// agrega una fila nueva (Inicio hoy, sin Fin -> arranca "activa")
export function agregarFila(territorioSugerido) {
  const ov = loadOverlay()
  const fila = {
    id: Date.now() + '-' + Math.random().toString(36).slice(2, 7),
    territorio: (territorioSugerido || '').toUpperCase(),
    inicio: todayISO(),
    fin: null,
    campania: false,
  }
  ov.filas = [...ov.filas, fila]
  return saveOverlay(ov)
}

// campo: 'territorio' | 'inicio' | 'fin' | 'campania' — sirve para filas
// nuevas (id propio) y para filas reales editadas (id 'real-<i>')
export function editarFila(id, campo, valor) {
  const ov = loadOverlay()
  const val = campo === 'territorio' ? String(valor).toUpperCase() : valor
  if (String(id).startsWith('real-')) {
    ov.ediciones = { ...ov.ediciones, [id]: { ...(ov.ediciones[id] || {}), [campo]: val } }
  } else {
    ov.filas = ov.filas.map((f) => (f.id === id ? { ...f, [campo]: val } : f))
  }
  return saveOverlay(ov)
}

export function eliminarFila(id) {
  const ov = loadOverlay()
  if (String(id).startsWith('real-')) {
    ov.ediciones = { ...ov.ediciones, [id]: { ...(ov.ediciones[id] || {}), eliminado: true } }
  } else {
    ov.filas = ov.filas.filter((f) => f.id !== id)
  }
  return saveOverlay(ov)
}

export function resetOverlay() { return saveOverlay(emptyOverlay()) }

export function overlayCount(overlay) {
  if (!overlay) return 0
  return (overlay.filas ? overlay.filas.length : 0) + (overlay.ediciones ? Object.keys(overlay.ediciones).length : 0)
}

// arma la lista combinada (registro real + ediciones + filas nuevas) para
// mostrar en la tabla, ya con todos los cambios aplicados
export function filasCombinadas(registroBase, overlay) {
  const ediciones = (overlay && overlay.ediciones) || {}
  const reales = (registroBase || [])
    .map((r, i) => {
      const id = 'real-' + i
      const ed = ediciones[id]
      if (ed && ed.eliminado) return null
      return {
        id,
        territorio: ed && ed.territorio !== undefined ? ed.territorio : r.territorio,
        inicio: ed && ed.inicio !== undefined ? ed.inicio : r.inicio,
        fin: ed && ed.fin !== undefined ? ed.fin : r.fin,
        campania: ed && ed.campania !== undefined ? ed.campania : !!r.campania,
        sim: false,
        editado: !!(ed && (ed.territorio !== undefined || ed.inicio !== undefined || ed.fin !== undefined || ed.campania !== undefined)),
      }
    })
    .filter(Boolean)
  const nuevas = ((overlay && overlay.filas) || []).map((f) => ({ ...f, sim: true }))
  return [...reales, ...nuevas]
}

// aplica el overlay al FeatureCollection de territorios/manzanas (colores del
// mapa): para cada territorio TOCADO (alguna edición o fila nueva), recalcula
// veces/última/campaña desde cero con sus filas combinadas actuales. El
// resto de los territorios queda intacto, tal cual venía del geojson real.
export function applyOverlay(fc, overlay, registroBase) {
  if (!fc) return fc
  const ediciones = (overlay && overlay.ediciones) || {}
  const filas = (overlay && overlay.filas) || []
  if (Object.keys(ediciones).length === 0 && filas.length === 0) return fc

  const terrsAfectados = new Set()
  for (const id of Object.keys(ediciones)) {
    const i = parseInt(id.slice(5), 10)
    const r = (registroBase || [])[i]
    if (r) {
      terrsAfectados.add(r.territorio)
      if (ediciones[id].territorio) terrsAfectados.add(ediciones[id].territorio)
    }
  }
  for (const f of filas) terrsAfectados.add(f.territorio)
  if (terrsAfectados.size === 0) return fc

  // filas combinadas (reales con ediciones aplicadas + nuevas) agrupadas por territorio
  const porTerr = {}
  ;(registroBase || []).forEach((r, i) => {
    const ed = ediciones['real-' + i]
    if (ed && ed.eliminado) return
    const territorio = ed && ed.territorio !== undefined ? ed.territorio : r.territorio
    if (!terrsAfectados.has(territorio)) return
    ;(porTerr[territorio] ||= []).push({
      inicio: ed && ed.inicio !== undefined ? ed.inicio : r.inicio,
      fin: ed && ed.fin !== undefined ? ed.fin : r.fin,
      campania: ed && ed.campania !== undefined ? ed.campania : !!r.campania,
    })
  })
  filas.forEach((f) => {
    if (!terrsAfectados.has(f.territorio)) return
    ;(porTerr[f.territorio] ||= []).push({ inicio: f.inicio, fin: f.fin, campania: f.campania })
  })

  return {
    ...fc,
    features: fc.features.map((f) => {
      const t = f.properties.territorio
      if (!terrsAfectados.has(t)) return f
      const rows = porTerr[t] || []
      const props = { ...f.properties }

      const completas = rows.filter((r) => r.fin)
      props.veces = completas.length
      if (completas.length) {
        const ultima = completas.map((r) => r.fin).sort().slice(-1)[0]
        props.ultima_fmt = fmtFecha(ultima) + ' (sim)'
        props.dias_desde = Math.max(0, Math.floor((Date.now() - new Date(ultima).getTime()) / 86400000))
      } else {
        props.ultima_fmt = 'sin registro'
        props.dias_desde = null
      }

      const marcadas = rows.filter((r) => r.campania)
      props.campania = marcadas.length > 0
      props.campania_hecho = marcadas.length > 0 && marcadas.every((r) => !!r.fin)
      return { ...f, properties: props }
    }),
  }
}
