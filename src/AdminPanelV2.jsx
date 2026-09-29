import { useEffect, useMemo, useState } from 'react'
import { IconSearch } from './icons.jsx'
import { generarS13Pdf, descargarBlob } from './s13.js'
import ProgramGenerator from './ProgramGenerator.jsx'
import AdminUsers from './AdminUsers.jsx'
import { AppDateField } from './DateTimeFields.jsx'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completado', label: 'Completado' },
  { key: 'activo', label: 'Activo' },
]
const CAMPOS = ['territorio', 'inicio', 'fin', 'campania', 'manzanasActivas']
const todayISO = () => new Date().toISOString().slice(0, 10)
const fechaCorta = (iso) => {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${String(y).slice(-2)}`
}
const copyRows = (rows) => rows.map((row) => ({ ...row }))
const isTemp = (id) => String(id).startsWith('nuevo-')

export default function AdminPanel({
  data, manzanas, registroBase, onSave, onLogout, onClose,
  onCampModoChange, campModoOn, metricsVisible, onMetricsVisibleChange,
  initialQuery, syncError, currentEmail, theme, onThemeToggle,
}) {
  const [view, setView] = useState('registros')
  const [q, setQ] = useState(initialQuery || '')
  const [filtro, setFiltro] = useState('todos')
  const [nuevoTerr, setNuevoTerr] = useState('')
  const [errorTerr, setErrorTerr] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [draft, setDraft] = useState(() => copyRows(registroBase || []))
  const [generandoS13, setGenerandoS13] = useState(false)
  const [generandoS13Anterior, setGenerandoS13Anterior] = useState(false)
  const [errorS13, setErrorS13] = useState('')
  const [exportOpen, setExportOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)

  useEffect(() => {
    if (!dirty) setDraft(copyRows(registroBase || []))
  }, [registroBase, dirty])

  const territoriosValidos = useMemo(() => new Set(data?.features.map((f) => f.properties.territorio) || []), [data])
  const territoriosOrdenados = useMemo(
    () => [...territoriosValidos].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)),
    [territoriosValidos],
  )
  const manzanasPorTerritorio = useMemo(() => {
    const result = {}
    for (const feature of manzanas?.features || []) {
      const territorio = feature.properties.territorio
      const numero = String(feature.properties.manzana)
      if (!result[territorio]) result[territorio] = new Set()
      result[territorio].add(numero)
    }
    return Object.fromEntries(Object.entries(result).map(([territorio, values]) => [
      territorio,
      [...values].sort((a, b) => Number(a) - Number(b)),
    ]))
  }, [manzanas])

  const dig = q.replace(/\D/g, '')
  let visibles = dig ? draft.filter((f) => String(parseInt(f.territorio.replace(/\D/g, ''), 10)) === dig || f.territorio.replace(/\D/g, '').startsWith(dig)) : draft
  if (filtro !== 'todos') visibles = visibles.filter((f) => (filtro === 'completado' ? !!f.fin : !!f.inicio && !f.fin))
  visibles = visibles.slice().reverse()
  const editingRow = visibles.find((f) => f.id === editingId) || null

  const runRemote = async (action) => {
    setSaving(true); setSaveError('')
    try { await action(); return true }
    catch (e) { console.error(e); setSaveError('No se pudo guardar. Revisá la conexión e intentá nuevamente.'); return false }
    finally { setSaving(false) }
  }
  const markDirty = (next) => { setDraft(next); setDirty(true); setSaveError('') }
  const editar = (fila, campo, valor) => markDirty(draft.map((r) => r.id === fila.id ? { ...r, [campo]: valor } : r))
  const cambiarTerritorio = (fila, territorio) => markDirty(draft.map((r) => r.id === fila.id ? { ...r, territorio, manzanasActivas: null } : r))
  const alternarManzana = (fila, numero) => {
    const todas = manzanasPorTerritorio[fila.territorio] || []
    const actuales = new Set(Array.isArray(fila.manzanasActivas) ? fila.manzanasActivas.map(String) : todas)
    if (actuales.has(numero)) actuales.delete(numero); else actuales.add(numero)
    const activas = todas.filter((value) => actuales.has(value))
    editar(fila, 'manzanasActivas', activas.length === todas.length ? null : activas)
  }

  const agregar = () => {
    const n = nuevoTerr.replace(/\D/g, '')
    const territorio = n ? `T${parseInt(n, 10)}` : ''
    if (!territorio || !territoriosValidos.has(territorio)) { setErrorTerr(true); return }
    markDirty([...draft, {
      id: `nuevo-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      territorio, inicio: todayISO(), fin: null, campania: false, manzanasActivas: null, createdOrder: Date.now(),
    }])
    setNuevoTerr(''); setErrorTerr(false)
  }

  const eliminar = (fila) => {
    if (!window.confirm(`¿Quitar el registro de ${fila.territorio}? No se eliminará de Firebase hasta guardar.`)) return
    markDirty(draft.filter((r) => r.id !== fila.id))
  }

  const guardar = async () => {
    const baseById = new Map((registroBase || []).map((r) => [r.id, r]))
    const draftIds = new Set(draft.filter((r) => !isTemp(r.id)).map((r) => r.id))
    const created = draft.filter((r) => isTemp(r.id))
    const updated = draft.filter((r) => !isTemp(r.id)).filter((r) => {
      const old = baseById.get(r.id)
      return old && CAMPOS.some((key) => key === 'manzanasActivas'
        ? JSON.stringify(old[key] ?? null) !== JSON.stringify(r[key] ?? null)
        : (old[key] ?? null) !== (r[key] ?? null))
    }).map((record) => ({ record, previousTerritorio: baseById.get(record.id).territorio }))
    const deleted = (registroBase || []).filter((r) => !draftIds.has(r.id))
    const ok = await runRemote(() => onSave({ created, updated, deleted }))
    if (ok) setDirty(false)
  }

  const pedirCierre = () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) return
    onClose()
  }
  const salir = async () => {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar sesión y descartarlos?')) return
    await runRemote(onLogout)
  }

  const exportar = () => {
    const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    const rows = draft.slice().reverse().map((f) => `<Row><Cell><Data ss:Type="String">${esc(f.territorio)}</Data></Cell><Cell><Data ss:Type="String">${esc(f.inicio)}</Data></Cell><Cell><Data ss:Type="String">${esc(f.fin || '')}</Data></Cell><Cell><Data ss:Type="String">${f.campania ? 'C' : ''}</Data></Cell></Row>`).join('')
    const xml = `<?xml version="1.0"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Registros"><Table><Row><Cell><Data ss:Type="String">Territorio</Data></Cell><Cell><Data ss:Type="String">Inicio</Data></Cell><Cell><Data ss:Type="String">Fin</Data></Cell><Cell><Data ss:Type="String">Campaña</Data></Cell></Row>${rows}</Table></Worksheet></Workbook>`
    const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.ms-excel' }))
    const a = document.createElement('a'); a.href = url; a.download = `territorios-${todayISO()}.xls`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const generarS13 = async (yearOffset = 0) => {
    const setGenerando = yearOffset === -1 ? setGenerandoS13Anterior : setGenerandoS13
    setGenerando(true); setErrorS13('')
    try {
      const result = await generarS13Pdf(draft, territoriosValidos, new Date(), yearOffset)
      descargarBlob(result.blob, result.filename)
    } catch (error) { console.error(error); setErrorS13('No se pudieron generar los S-13. Volvé a intentarlo.') }
    finally { setGenerando(false) }
  }

  return (
    <div className="admin-panel-bg" onClick={pedirCierre}>
      <div className={`admin-panel theme-${theme}`} onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-head">
          <div className="admin-panel-grip" />
          <div className="admin-panel-hrow">
            <span className="admin-panel-title">Administración</span>
            <div className="admin-panel-hbtns">
              {view === 'registros' && <div className="admin-head-export">
                <button className="search-x" onClick={() => setExportOpen((v) => !v)} aria-label="Exportar" aria-expanded={exportOpen}>⋯</button>
                {exportOpen && <div className="admin-export-options">
                  <button className="admin-foot-btn" onClick={() => generarS13(0)} disabled={dirty || generandoS13 || generandoS13Anterior}>S-13 actual</button>
                  <button className="admin-foot-btn" onClick={() => generarS13(-1)} disabled={dirty || generandoS13 || generandoS13Anterior}>S-13 anterior</button>
                  <button className="admin-foot-btn" onClick={exportar} disabled={dirty}>Excel</button>
                </div>}
              </div>}
              {view === 'registros' && <button className={'admin-head-save' + (dirty ? ' dirty' : '')} onClick={guardar} disabled={!dirty || saving} aria-label="Guardar cambios" title="Guardar cambios">{saving ? '…' : 'Guardar'}</button>}
              <button className="search-x admin-theme-toggle" onClick={onThemeToggle} aria-label={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}>{theme === 'dark' ? '☀' : '☾'}</button>
              <button className="search-x" onClick={pedirCierre} aria-label="Cerrar">×</button>
            </div>
          </div>
          <div className="admin-tabs">
            <button className={view === 'registros' ? 'on' : ''} onClick={() => setView('registros')}>Registros</button>
            <button className={view === 'programa' ? 'on' : ''} onClick={() => setView('programa')}><span className="tab-wide">Generar programa</span><span className="tab-short">Programa</span></button>
            <button className={view === 'admins' ? 'on' : ''} onClick={() => setView('admins')}><span className="tab-wide">Administradores</span><span className="tab-short">Admins</span></button>
          </div>
          {view === 'registros' && <div className="admin-panel-sub"><span className={'admin-sync-dot' + (dirty ? ' dirty' : '')} />{draft.length} registros · {saving ? 'guardando…' : dirty ? 'cambios sin guardar' : 'sincronizado'}</div>}
        </div>

        {view === 'programa' ? <ProgramGenerator /> : view === 'admins' ? <AdminUsers currentEmail={currentEmail} onLogout={salir} /> : <>
          <div className="admin-record-tools">
            <div className="admin-public-settings">
              <div className="admin-campmode">
                <div><div className="admin-campmode-label">Modo campaña</div><div className="admin-campmode-sub">{campModoOn ? 'Visible y editable.' : 'Oculto para todos.'}</div></div>
                <button className={'admin-switch' + (campModoOn ? ' on' : '')} disabled={saving} onClick={() => runRemote(() => onCampModoChange(!campModoOn))} aria-label="Mostrar modo campaña" aria-pressed={campModoOn}><span className="admin-switch-knob" /></button>
              </div>
              <div className="admin-campmode">
                <div><div className="admin-campmode-label">Métrica pública</div><div className="admin-campmode-sub">{metricsVisible ? 'Visible sin iniciar sesión.' : 'Solo visible para administradores.'}</div></div>
                <button className={'admin-switch' + (metricsVisible ? ' on' : '')} disabled={saving} onClick={() => runRemote(() => onMetricsVisibleChange(!metricsVisible))} aria-label="Mostrar Métrica a usuarios públicos" aria-pressed={metricsVisible}><span className="admin-switch-knob" /></button>
              </div>
            </div>
            <div className="admin-search"><IconSearch /><input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Filtrar por N° de territorio" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          </div>
          <div className="admin-filtros">
            {FILTROS.map((f) => <button key={f.key} className={'admin-filtro-btn' + (filtro === f.key ? ' on' : '')} onClick={() => setFiltro(f.key)}>{f.label}</button>)}
            <div className="admin-add-row"><input className={'admin-add-terr' + (errorTerr ? ' error' : '')} placeholder="T##" value={nuevoTerr} onChange={(e) => { setNuevoTerr(e.target.value); setErrorTerr(false) }} onKeyDown={(e) => e.key === 'Enter' && agregar()} /><button className="admin-mini-btn primary" onClick={agregar}><span className="desktop-label">+ Agregar fila</span><span className="mobile-label">+ Fila</span></button></div>
          </div>
          {errorTerr && <div className="admin-add-error">Ese territorio no existe.</div>}
          {editingRow && <div className={'admin-editor-card' + (editingRow.inicio && !editingRow.fin ? ' activo' : '')}>
            <div className="admin-accordion-head">
              <strong>Editar {editingRow.territorio}</strong>
              <div className="admin-accordion-actions">
                <button className="admin-row-done" onClick={() => setEditingId(null)} aria-label="Terminar edición">✓</button>
                <button className="admin-mini-btn ghost danger" disabled={saving} onClick={() => eliminar(editingRow)}>Eliminar</button>
              </div>
            </div>
            <div className="admin-accordion-grid">
              <label><span>Territorio</span><select value={editingRow.territorio} disabled={saving} onChange={(e) => cambiarTerritorio(editingRow, e.target.value)}>{territoriosOrdenados.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
              <label><span>Campaña</span><button className={'admin-c-btn' + (editingRow.campania ? ' on' : '')} disabled={!campModoOn || saving} onClick={() => editar(editingRow, 'campania', !editingRow.campania)}>{editingRow.campania ? 'Sí' : 'No'}</button></label>
              <AppDateField label="Inicio" value={editingRow.inicio || ''} max={editingRow.fin || todayISO()} disabled={saving} onChange={(value) => editar(editingRow, 'inicio', value)} />
              <AppDateField label="Fin" value={editingRow.fin || ''} min={editingRow.inicio || undefined} max={todayISO()} disabled={saving} onChange={(value) => editar(editingRow, 'fin', value || null)} />
              {editingRow.inicio && !editingRow.fin && <div className="admin-manzanas-field">
                <div className="admin-manzanas-head"><span>Manzanas activas</span><button type="button" disabled={saving} onClick={() => editar(editingRow, 'manzanasActivas', null)}>Todas activas</button></div>
                <div className="admin-manzanas-options">
                  {(manzanasPorTerritorio[editingRow.territorio] || []).map((numero) => {
                    const activas = Array.isArray(editingRow.manzanasActivas) ? editingRow.manzanasActivas.map(String) : manzanasPorTerritorio[editingRow.territorio] || []
                    const on = activas.includes(numero)
                    return <button type="button" key={numero} className={on ? 'on' : ''} disabled={saving} aria-pressed={on} onClick={() => alternarManzana(editingRow, numero)}>{numero}</button>
                  })}
                </div>
                <small>Las que desactives aparecerán tachadas al abrir el territorio.</small>
              </div>}
            </div>
          </div>}
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Terr.</th><th>Inicio</th><th>Fin</th><th>C</th><th /></tr></thead>
            <tbody>
              {!visibles.length && <tr><td colSpan={5} className="admin-table-empty">Sin filas para este filtro.</td></tr>}
              {visibles.filter((f) => f.id !== editingId).map((f) => {
                return <tr key={f.id} className={f.inicio && !f.fin ? 'activo' : ''} onClick={() => setEditingId(f.id)}>
                  <td className="admin-table-terr" data-label="Territorio"><strong>{f.territorio}</strong></td>
                  <td data-label="Inicio"><span>{fechaCorta(f.inicio)}</span></td>
                  <td data-label="Fin"><span className={!f.fin ? 'admin-active-text' : ''}>{f.fin ? fechaCorta(f.fin) : 'Activo'}</span></td>
                  <td data-label="Campaña">{f.campania ? <span className="admin-c-badge">C</span> : <span className="admin-c-empty">—</span>}</td>
                  <td className="admin-row-delete"><button className="admin-row-open" onClick={(e) => { e.stopPropagation(); setEditingId(f.id) }} aria-label={`Editar ${f.territorio}`}>›</button></td>
                </tr>
              })}
            </tbody>
          </table></div>
          {(errorS13 || saveError || syncError) && <div className="admin-export-error">{errorS13 || saveError || syncError}</div>}
        </>}
      </div>
    </div>
  )
}
