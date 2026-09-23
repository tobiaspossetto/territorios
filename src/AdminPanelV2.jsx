import { useEffect, useMemo, useState } from 'react'
import { IconLogout, IconSearch, IconExpand, IconCollapse } from './icons.jsx'
import { generarS13Pdf, descargarBlob } from './s13.js'
import ProgramGenerator from './ProgramGenerator.jsx'
import AdminUsers from './AdminUsers.jsx'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completado', label: 'Completado' },
  { key: 'activo', label: 'Activo' },
]
const CAMPOS = ['territorio', 'inicio', 'fin', 'campania']
const todayISO = () => new Date().toISOString().slice(0, 10)
const copyRows = (rows) => rows.map((row) => ({ ...row }))
const isTemp = (id) => String(id).startsWith('nuevo-')

export default function AdminPanel({
  data, registroBase, onSave, onLogout, onClose,
  onCampModoChange, campModoOn, initialQuery, syncError, currentEmail,
}) {
  const [view, setView] = useState('registros')
  const [q, setQ] = useState(initialQuery || '')
  const [filtro, setFiltro] = useState('todos')
  const [nuevoTerr, setNuevoTerr] = useState('')
  const [errorTerr, setErrorTerr] = useState(false)
  const [full, setFull] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [dirty, setDirty] = useState(false)
  const [draft, setDraft] = useState(() => copyRows(registroBase || []))
  const [generandoS13, setGenerandoS13] = useState(false)
  const [generandoS13Anterior, setGenerandoS13Anterior] = useState(false)
  const [errorS13, setErrorS13] = useState('')

  useEffect(() => {
    if (!dirty) setDraft(copyRows(registroBase || []))
  }, [registroBase, dirty])

  const territoriosValidos = useMemo(() => new Set(data?.features.map((f) => f.properties.territorio) || []), [data])
  const territoriosOrdenados = useMemo(
    () => [...territoriosValidos].sort((a, b) => parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10)),
    [territoriosValidos],
  )

  const dig = q.replace(/\D/g, '')
  let visibles = dig ? draft.filter((f) => String(parseInt(f.territorio.replace(/\D/g, ''), 10)) === dig || f.territorio.replace(/\D/g, '').startsWith(dig)) : draft
  if (filtro !== 'todos') visibles = visibles.filter((f) => (filtro === 'completado' ? !!f.fin : !!f.inicio && !f.fin))
  visibles = visibles.slice().reverse()

  const runRemote = async (action) => {
    setSaving(true); setSaveError('')
    try { await action(); return true }
    catch (e) { console.error(e); setSaveError('No se pudo guardar. Revisá la conexión e intentá nuevamente.'); return false }
    finally { setSaving(false) }
  }
  const markDirty = (next) => { setDraft(next); setDirty(true); setSaveError('') }
  const editar = (fila, campo, valor) => markDirty(draft.map((r) => r.id === fila.id ? { ...r, [campo]: valor } : r))

  const agregar = () => {
    const n = nuevoTerr.replace(/\D/g, '')
    const territorio = n ? `T${parseInt(n, 10)}` : ''
    if (!territorio || !territoriosValidos.has(territorio)) { setErrorTerr(true); return }
    markDirty([...draft, {
      id: `nuevo-${crypto.randomUUID ? crypto.randomUUID() : Date.now()}`,
      territorio, inicio: todayISO(), fin: null, campania: false, createdOrder: Date.now(),
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
      return old && CAMPOS.some((key) => (old[key] ?? null) !== (r[key] ?? null))
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
      <div className={'admin-panel' + (full ? ' full' : '')} onClick={(e) => e.stopPropagation()}>
        <div className="admin-panel-head">
          <div className="admin-panel-grip" />
          <div className="admin-panel-hrow">
            <span className="admin-panel-title">Administración</span>
            <div className="admin-panel-hbtns">
              <button className="search-x" onClick={() => setFull((v) => !v)} aria-label={full ? 'Achicar' : 'Pantalla completa'}>{full ? <IconCollapse /> : <IconExpand />}</button>
              <button className="search-x" onClick={pedirCierre} aria-label="Cerrar">×</button>
            </div>
          </div>
          <div className="admin-tabs">
            <button className={view === 'registros' ? 'on' : ''} onClick={() => setView('registros')}>Registros</button>
            <button className={view === 'programa' ? 'on' : ''} onClick={() => setView('programa')}>Generar programa</button>
            <button className={view === 'admins' ? 'on' : ''} onClick={() => setView('admins')}>Administradores</button>
          </div>
          {view === 'registros' && <div className="admin-panel-sub">Firebase · {draft.length} filas · {saving ? 'guardando…' : dirty ? 'cambios sin guardar' : 'sincronizado'}</div>}
        </div>

        {view === 'programa' ? <ProgramGenerator /> : view === 'admins' ? <AdminUsers currentEmail={currentEmail} /> : <>
          <div className="admin-campmode">
            <div><div className="admin-campmode-label">Modo campaña</div><div className="admin-campmode-sub">{campModoOn ? 'Activo: se puede marcar la columna Campaña.' : 'Apagado: la columna Campaña está bloqueada.'}</div></div>
            <button className={'admin-switch' + (campModoOn ? ' on' : '')} onClick={() => runRemote(() => onCampModoChange(!campModoOn))} aria-pressed={campModoOn}><span className="admin-switch-knob" /></button>
          </div>
          <div className="admin-search"><IconSearch /><input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Filtrar por N° de territorio" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="admin-filtros">
            {FILTROS.map((f) => <button key={f.key} className={'admin-filtro-btn' + (filtro === f.key ? ' on' : '')} onClick={() => setFiltro(f.key)}>{f.label}</button>)}
            <div className="admin-add-row"><input className={'admin-add-terr' + (errorTerr ? ' error' : '')} placeholder="T##" value={nuevoTerr} onChange={(e) => { setNuevoTerr(e.target.value); setErrorTerr(false) }} onKeyDown={(e) => e.key === 'Enter' && agregar()} /><button className="admin-mini-btn primary" onClick={agregar}>+ Agregar fila</button></div>
          </div>
          {errorTerr && <div className="admin-add-error">Ese territorio no existe.</div>}
          <div className="admin-table-wrap"><table className="admin-table">
            <thead><tr><th>Territorio</th><th>Inicio</th><th>Fin</th><th>Campaña</th><th /></tr></thead>
            <tbody>
              {!visibles.length && <tr><td colSpan={5} className="admin-table-empty">Sin filas para este filtro.</td></tr>}
              {visibles.map((f) => <tr key={f.id} className={f.inicio && !f.fin ? 'activo' : ''}>
                <td className="admin-table-terr"><select value={f.territorio} disabled={saving} onChange={(e) => editar(f, 'territorio', e.target.value)}>{territoriosOrdenados.map((t) => <option key={t} value={t}>{t}</option>)}</select></td>
                <td><input type="date" value={f.inicio || ''} max={f.fin || todayISO()} disabled={saving} onChange={(e) => editar(f, 'inicio', e.target.value)} /></td>
                <td><input type="date" value={f.fin || ''} min={f.inicio || undefined} max={todayISO()} disabled={saving} onChange={(e) => editar(f, 'fin', e.target.value || null)} />{f.inicio && !f.fin && <span className="admin-table-tag activo">activo</span>}</td>
                <td><button className={'admin-c-btn' + (f.campania ? ' on' : '')} disabled={!campModoOn || saving} onClick={() => editar(f, 'campania', !f.campania)}>C</button></td>
                <td><button className="admin-mini-btn ghost danger" disabled={saving} onClick={() => eliminar(f)}>Eliminar</button></td>
              </tr>)}
            </tbody>
          </table></div>
          <div className="admin-panel-foot">
            <button className="admin-foot-btn save" onClick={guardar} disabled={!dirty || saving}>{saving ? 'Guardando…' : dirty ? 'Guardar cambios' : 'Sin cambios'}</button>
            <button className="admin-foot-btn" onClick={() => generarS13(0)} disabled={dirty || generandoS13 || generandoS13Anterior}>{generandoS13 ? 'Generando…' : 'Generar S-13'}</button>
            <button className="admin-foot-btn" onClick={() => generarS13(-1)} disabled={dirty || generandoS13 || generandoS13Anterior}>{generandoS13Anterior ? 'Generando…' : 'S-13 año anterior'}</button>
            <button className="admin-foot-btn" onClick={exportar} disabled={dirty}>Exportar Excel</button>
            <button className="admin-foot-btn danger" onClick={salir}><IconLogout /> Cerrar sesión</button>
          </div>
          {(errorS13 || saveError || syncError) && <div className="admin-export-error">{errorS13 || saveError || syncError}</div>}
        </>}
      </div>
    </div>
  )
}
