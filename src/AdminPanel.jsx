import { useMemo, useState } from 'react'
import {
  loadOverlay, agregarFila, editarFila, eliminarFila,
  filasCombinadas, resetOverlay, overlayCount, setAdminSession,
  isCampaniaModoActivo, setCampaniaModoActivo, todayISO,
} from './adminData.js'
import { IconLogout, IconSearch, IconExpand, IconCollapse } from './icons.jsx'
import { generarS13Zip, descargarBlob } from './s13.js'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completado', label: 'Completado' },
  { key: 'activo', label: 'Activo' },
]

// "Registro de territorios": una sola tabla, igual que el Excel — todas las
// filas reales + las que se van cargando acá, más nuevas primero. Cada
// acción escribe en localStorage (ver adminData.js) y el mapa de atrás se
// actualiza al toque.
export default function AdminPanel({ data, registroBase, onChange, onLogout, onClose, onCampModoChange, initialQuery }) {
  const [q, setQ] = useState(initialQuery || '')
  const [filtro, setFiltro] = useState('todos')
  const [overlay, setOverlayState] = useState(loadOverlay)
  const [campModoOn, setCampModoOn] = useState(isCampaniaModoActivo)
  const [nuevoTerr, setNuevoTerr] = useState('')
  const [errorTerr, setErrorTerr] = useState(false)
  const [full, setFull] = useState(false)
  const [generandoS13, setGenerandoS13] = useState(false)
  const [generandoS13Anterior, setGenerandoS13Anterior] = useState(false)
  const [errorS13, setErrorS13] = useState('')

  const refresh = (next) => { setOverlayState(next); onChange(next) }

  const territoriosValidos = useMemo(() => {
    if (!data) return new Set()
    return new Set(data.features.map((f) => f.properties.territorio))
  }, [data])
  const territoriosOrdenados = useMemo(
    () => [...territoriosValidos].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)),
    [territoriosValidos],
  )

  const filas = useMemo(() => filasCombinadas(registroBase, overlay), [registroBase, overlay])

  const dig = q.replace(/\D/g, '')
  let visibles = dig ? filas.filter((f) => String(parseInt(f.territorio.replace(/\D/g, ''), 10)) === dig || f.territorio.replace(/\D/g, '').startsWith(dig)) : filas
  if (filtro !== 'todos') visibles = visibles.filter((f) => (filtro === 'completado' ? !!f.fin : !f.fin))
  // último agregado primero: filasCombinadas ya viene en orden de carga (reales
  // en el orden del Excel, nuevas al final en el orden en que se fueron
  // agregando acá) -> dar vuelta la lista alcanza, sin mirar fechas
  visibles = visibles.slice().reverse()

  const nCambios = overlayCount(overlay)

  const toggleCampModo = () => {
    const next = !campModoOn
    setCampaniaModoActivo(next)
    setCampModoOn(next)
    if (onCampModoChange) onCampModoChange(next)
  }
  const salir = () => { setAdminSession(false); onLogout() }

  const toggleCampania = (fila) => refresh(editarFila(fila.id, 'campania', !fila.campania))

  const agregar = () => {
    // acepta "8", "08", "t8", "T8"... -> siempre normaliza a "T8"
    const n = nuevoTerr.replace(/\D/g, '')
    const t = n ? 'T' + parseInt(n, 10) : ''
    if (!t || !territoriosValidos.has(t)) { setErrorTerr(true); return }
    refresh(agregarFila(t))
    setNuevoTerr('')
    setErrorTerr(false)
  }

  const exportar = () => {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const rows = filas.slice().reverse().map((f) =>
      `<Row><Cell><Data ss:Type="String">${esc(f.territorio)}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(f.inicio)}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${esc(f.fin || '')}</Data></Cell>` +
      `<Cell><Data ss:Type="String">${f.campania ? 'C' : ''}</Data></Cell></Row>`
    ).join('')
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Registros"><Table><Row><Cell><Data ss:Type="String">Territorio</Data></Cell><Cell><Data ss:Type="String">Inicio</Data></Cell><Cell><Data ss:Type="String">Fin</Data></Cell><Cell><Data ss:Type="String">Campaña</Data></Cell></Row>${rows}</Table></Worksheet></Workbook>`
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel' }))
    const a = document.createElement('a')
    a.href = url; a.download = `territorios-${todayISO()}.xls`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const generarS13 = async (yearOffset = 0) => {
    const setGenerando = yearOffset === -1 ? setGenerandoS13Anterior : setGenerandoS13
    setGenerando(true)
    setErrorS13('')
    try {
      const result = await generarS13Zip(filas, territoriosValidos, new Date(), yearOffset)
      descargarBlob(result.blob, result.filename)
    } catch (error) {
      console.error(error)
      setErrorS13('No se pudieron generar los S-13. Volvé a intentarlo.')
    } finally {
      setGenerando(false)
    }
  }

  return (
    <div className="admin-panel-bg" onClick={onClose}>
      <div className={'admin-panel' + (full ? ' full' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-head">
          <div className="admin-panel-grip" />
          <div className="admin-panel-hrow">
            <span className="admin-panel-title">Registro de territorios</span>
            <div className="admin-panel-hbtns">
              <button className="search-x" onClick={() => setFull((v) => !v)} aria-label={full ? 'Achicar' : 'Pantalla completa'}>
                {full ? <IconCollapse /> : <IconExpand />}
              </button>
              <button className="search-x" onClick={onClose} aria-label="Cerrar">×</button>
            </div>
          </div>
          <div className="admin-panel-sub">
            Modo admin (PoC local) · {filas.length} filas · {nCambios > 0 ? `${nCambios} cambio${nCambios === 1 ? '' : 's'} sin sincronizar` : 'sin cambios todavía'}
          </div>

          <div className="admin-campmode">
            <div>
              <div className="admin-campmode-label">Modo campaña</div>
              <div className="admin-campmode-sub">
                {campModoOn ? 'Activo: se puede marcar la columna Campaña.' : 'Apagado: nadie puede tocar la columna Campaña hasta que lo actives.'}
              </div>
            </div>
            <button className={'admin-switch' + (campModoOn ? ' on' : '')} onClick={toggleCampModo} aria-pressed={campModoOn}>
              <span className="admin-switch-knob" />
            </button>
          </div>
        </div>

        <div className="admin-search">
          <IconSearch />
          <input
            type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Filtrar por N° de territorio"
            value={q} onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="admin-filtros">
          {FILTROS.map((f) => (
            <button
              key={f.key} className={'admin-filtro-btn' + (filtro === f.key ? ' on' : '')}
              onClick={() => setFiltro(f.key)}
            >
              {f.label}
            </button>
          ))}
          <div className="admin-add-row">
            <input
              className={'admin-add-terr' + (errorTerr ? ' error' : '')} placeholder="T##" value={nuevoTerr}
              onChange={(e) => { setNuevoTerr(e.target.value); setErrorTerr(false) }}
              onKeyDown={(e) => e.key === 'Enter' && agregar()}
            />
            <button className="admin-mini-btn primary" onClick={agregar}>+ Agregar fila</button>
          </div>
        </div>
        {errorTerr && <div className="admin-add-error">Ese territorio no existe. Probá con un número entre los 64 (ej. 15, T15).</div>}

        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Territorio</th>
                <th>Inicio</th>
                <th>Fin</th>
                <th title={campModoOn ? '' : 'Activá el modo campaña para usar esto'}>Campaña</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.length === 0 && (
                <tr><td colSpan={5} className="admin-table-empty">Sin filas para este filtro.</td></tr>
              )}
              {visibles.map((f) => (
                <tr key={f.id} className={(f.fin ? '' : 'activo') + (f.sim ? ' sim' : '') + (f.editado ? ' editado' : '')}>
                  <td className="admin-table-terr">
                    <select value={f.territorio} onChange={(e) => refresh(editarFila(f.id, 'territorio', e.target.value))}>
                      {territoriosOrdenados.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {f.sim && <span className="admin-table-tag">sim</span>}
                    {f.editado && <span className="admin-table-tag editado">editado</span>}
                  </td>
                  <td>
                    <input
                      type="date" value={f.inicio} max={f.fin || todayISO()}
                      onChange={(e) => refresh(editarFila(f.id, 'inicio', e.target.value))}
                    />
                  </td>
                  <td>
                    <input
                      type="date" value={f.fin || ''} min={f.inicio} max={todayISO()}
                      onChange={(e) => refresh(editarFila(f.id, 'fin', e.target.value || null))}
                    />
                    {!f.fin && <span className="admin-table-tag activo">activo</span>}
                  </td>
                  <td>
                    <button
                      className={'admin-c-btn' + (f.campania ? ' on' : '')}
                      disabled={!campModoOn}
                      title={campModoOn ? 'Marcar/quitar esta fila de la campaña' : 'Activá el modo campaña para usar esto'}
                      onClick={() => toggleCampania(f)}
                    >
                      C
                    </button>
                  </td>
                  <td>
                    <button className="admin-mini-btn ghost danger" onClick={() => refresh(eliminarFila(f.id))}>
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="admin-panel-foot">
          <button className="admin-foot-btn primary" onClick={() => generarS13(0)} disabled={generandoS13 || generandoS13Anterior}>
            {generandoS13 ? 'Generando…' : 'Generar S-13'}
          </button>
          <button className="admin-foot-btn" onClick={() => generarS13(-1)} disabled={generandoS13 || generandoS13Anterior}>
            {generandoS13Anterior ? 'Generando…' : 'S-13 año anterior'}
          </button>
          <button className="admin-foot-btn" onClick={exportar}>Exportar Excel</button>
          <button className="admin-foot-btn" onClick={() => { resetOverlay(); refresh(loadOverlay()) }}>
            Reiniciar simulación
          </button>
          <button className="admin-foot-btn danger" onClick={salir}>
            <IconLogout /> Cerrar sesión
          </button>
        </div>
        {errorS13 && <div className="admin-export-error">{errorS13}</div>}
      </div>
    </div>
  )
}
