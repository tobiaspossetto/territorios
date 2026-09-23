import { useMemo, useState } from 'react'
import { todayISO } from './adminData.js'
import { IconLogout, IconSearch, IconExpand, IconCollapse } from './icons.jsx'
import { generarS13Zip, descargarBlob } from './s13.js'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completado', label: 'Completado' },
  { key: 'activo', label: 'Activo' },
]

export default function AdminPanel({
  data, registroBase, onAdd, onUpdate, onDelete, onLogout, onClose,
  onCampModoChange, campModoOn, initialQuery, syncError,
}) {
  const [q, setQ] = useState(initialQuery || '')
  const [filtro, setFiltro] = useState('todos')
  const [nuevoTerr, setNuevoTerr] = useState('')
  const [errorTerr, setErrorTerr] = useState(false)
  const [full, setFull] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [generandoS13, setGenerandoS13] = useState(false)
  const [generandoS13Anterior, setGenerandoS13Anterior] = useState(false)
  const [errorS13, setErrorS13] = useState('')

  const territoriosValidos = useMemo(() => {
    if (!data) return new Set()
    return new Set(data.features.map((f) => f.properties.territorio))
  }, [data])
  const territoriosOrdenados = useMemo(
    () => [...territoriosValidos].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)),
    [territoriosValidos],
  )

  const filas = registroBase || []

  const dig = q.replace(/\D/g, '')
  let visibles = dig ? filas.filter((f) => String(parseInt(f.territorio.replace(/\D/g, ''), 10)) === dig || f.territorio.replace(/\D/g, '').startsWith(dig)) : filas
  if (filtro !== 'todos') visibles = visibles.filter((f) => (filtro === 'completado' ? !!f.fin : !f.fin))
  // Firestore entrega el orden de creación ascendente; la tabla muestra lo
  // último agregado primero, igual que el Excel original.
  visibles = visibles.slice().reverse()

  const runSave = async (action) => {
    setSaving(true); setSaveError('')
    try { await action() }
    catch (e) { console.error(e); setSaveError('No se pudo guardar. Revisá la conexión e intentá nuevamente.') }
    finally { setSaving(false) }
  }

  const toggleCampModo = async () => {
    const next = !campModoOn
    await runSave(() => onCampModoChange(next))
  }
  const salir = () => runSave(onLogout)

  const toggleCampania = (fila) => runSave(() => onUpdate(fila, 'campania', !fila.campania))

  const agregar = async () => {
    // acepta "8", "08", "t8", "T8"... -> siempre normaliza a "T8"
    const n = nuevoTerr.replace(/\D/g, '')
    const t = n ? 'T' + parseInt(n, 10) : ''
    if (!t || !territoriosValidos.has(t)) { setErrorTerr(true); return }
    await runSave(async () => { await onAdd(t); setNuevoTerr(''); setErrorTerr(false) })
  }

  const editar = (fila, campo, valor) => runSave(() => onUpdate(fila, campo, valor))
  const eliminar = (fila) => {
    if (!window.confirm(`¿Eliminar el registro de ${fila.territorio}?`)) return
    runSave(() => onDelete(fila))
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
            Firebase · {filas.length} filas · {saving ? 'guardando…' : 'sincronizado'}
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
                <tr key={f.id} className={f.fin ? '' : 'activo'}>
                  <td className="admin-table-terr">
                    <select value={f.territorio} disabled={saving} onChange={(e) => editar(f, 'territorio', e.target.value)}>
                      {territoriosOrdenados.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </td>
                  <td>
                    <input
                      type="date" value={f.inicio} max={f.fin || todayISO()} disabled={saving}
                      onChange={(e) => editar(f, 'inicio', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="date" value={f.fin || ''} min={f.inicio} max={todayISO()} disabled={saving}
                      onChange={(e) => editar(f, 'fin', e.target.value || null)}
                    />
                    {!f.fin && <span className="admin-table-tag activo">activo</span>}
                  </td>
                  <td>
                    <button
                      className={'admin-c-btn' + (f.campania ? ' on' : '')}
                      disabled={!campModoOn || saving}
                      title={campModoOn ? 'Marcar/quitar esta fila de la campaña' : 'Activá el modo campaña para usar esto'}
                      onClick={() => toggleCampania(f)}
                    >
                      C
                    </button>
                  </td>
                  <td>
                    <button className="admin-mini-btn ghost danger" disabled={saving} onClick={() => eliminar(f)}>
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
          <button className="admin-foot-btn danger" onClick={salir}>
            <IconLogout /> Cerrar sesión
          </button>
        </div>
        {(errorS13 || saveError || syncError) && <div className="admin-export-error">{errorS13 || saveError || syncError}</div>}
      </div>
    </div>
  )
}
