import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { IconAdmin, IconCalendar, IconList, IconSearch } from './icons.jsx'
import ProgramGenerator from './ProgramGenerator.jsx'
import AdminUsers from './AdminUsers.jsx'
import ProgramWeekSettings from './ProgramWeekSettings.jsx'
import SplashTypeSettings from './SplashTypeSettings.jsx'
import { AppDateField } from './DateTimeFields.jsx'
import RecordEditorSurface from './RecordEditorSurface.jsx'
import RecordFields from './RecordFields.jsx'
import DiscardChangesDialog from './DiscardChangesDialog.jsx'
import {startedTerritoryRecord} from './recordShortcut.js'

const FILTROS = [
  { key: 'todos', label: 'Todos' },
  { key: 'completado', label: 'Completado' },
  { key: 'activo', label: 'Empezado' },
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
  data, manzanas, registroBase, onSave, onLogout, onClose, onMinimize, minimized=false,
  onCampModoChange, campModoOn, metricsVisible, onMetricsVisibleChange,
  programWeekStart=0, onProgramWeekStartChange,
  splashType='collage',onSplashTypeChange,
  initialQuery, recordRequest, onRecordRequestHandled, syncError, currentEmail, theme, recordsReady=true,
  preview = false,
  designPreview = false,
}) {
  const [view, setView] = useState('registros')
  const filtersRef = useRef(null)
  const [filtersHeight,setFiltersHeight] = useState(0)
  useLayoutEffect(()=>{
    const node=filtersRef.current
    if(view!=='registros'||!designPreview||!node)return
    const measure=()=>setFiltersHeight(Math.ceil(node.getBoundingClientRect().height))
    measure()
    const observer=new ResizeObserver(measure)
    observer.observe(node)
    return()=>observer.disconnect()
  },[view,designPreview])
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
  const [exportingExcel,setExportingExcel]=useState(false)
  const [editingId, setEditingId] = useState(null)
  const [newRecord,setNewRecord]=useState(null)
  const [discardRequest,setDiscardRequest]=useState(null)
  const handledRequest=useRef(null)

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
  const editingRow = newRecord || draft.find((f) => f.id === editingId) || null
  useEffect(()=>{
    if(!designPreview||!recordRequest||!recordsReady||handledRequest.current===recordRequest)return
    handledRequest.current=recordRequest
    setView('registros')
    setQ(recordRequest.territorio.replace(/\D/g,''))
    const started=startedTerritoryRecord(dirty?draft:registroBase,recordRequest.territorio)
    setNewRecord(started?null:{id:`nuevo-${crypto.randomUUID()}`,territorio:recordRequest.territorio,inicio:todayISO(),fin:null,campania:false,manzanasActivas:null,createdOrder:Date.now()})
    setEditingId(started?.id||null)
    onRecordRequestHandled?.(recordRequest)
  },[recordRequest,designPreview,onRecordRequestHandled,recordsReady,registroBase,draft,dirty])

  const runRemote = async (action) => {
    setSaving(true); setSaveError('')
    try { await action(); return true }
    catch (e) { console.error(e); setSaveError('No se pudo guardar. Revisá la conexión e intentá nuevamente.'); return false }
    finally { setSaving(false) }
  }
  const markDirty = (next) => { setDraft(next); setDirty(true); setSaveError('') }
  const editar = (fila, campo, valor) => newRecord?.id===fila.id ? setNewRecord({...fila,[campo]:valor}) : markDirty(draft.map((r) => r.id === fila.id ? { ...r, [campo]: valor } : r))
  const cambiarTerritorio = (fila, territorio) => newRecord?.id===fila.id ? setNewRecord({...fila,territorio,manzanasActivas:null}) : markDirty(draft.map((r) => r.id === fila.id ? { ...r, territorio, manzanasActivas: null } : r))
  const closeEditor=()=>{
    if(newRecord){
      setDiscardRequest({message:'¿Descartar este nuevo registro? Los datos que completaste no se agregarán al borrador.',confirmLabel:'Descartar registro',action:()=>{setNewRecord(null);setEditingId(null)}})
      return
    }
    setNewRecord(null);setEditingId(null)
  }
  const finishEditor=()=>{
    if(newRecord){markDirty([...draft,newRecord]);setNewRecord(null)}
    setEditingId(null)
  }
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

  const restablecerCampania = async () => {
    if (dirty) {
      setSaveError('Guardá o descartá los cambios pendientes antes de restablecer la campaña.')
      return
    }
    if (!window.confirm('Se reiniciarán los datos del modo Campaña. Solo hacer esto para comenzar una nueva campaña')) return
    const marcados = draft.filter((record) => record.campania)
    if (!marcados.length) return
    const updated = marcados.map((record) => ({
      record: { ...record, campania: false },
      previousTerritorio: record.territorio,
    }))
    const ok = await runRemote(() => onSave({ created: [], updated, deleted: [] }))
    if (ok) setDraft((rows) => rows.map((record) => record.campania ? { ...record, campania: false } : record))
  }

  const pedirCierre = () => {
    if(dirty){setDiscardRequest({message:'Tenés cambios pendientes en los registros. Si cerrás Administración, se descartarán.',confirmLabel:'Descartar y cerrar',action:onClose});return}
    onClose()
  }
  const salir = async () => {
    if(dirty){setDiscardRequest({message:'Tenés cambios pendientes en los registros. Si cerrás sesión, se descartarán.',confirmLabel:'Descartar y salir',action:()=>runRemote(onLogout)});return}
    await runRemote(onLogout)
  }

  const exportar = async () => {
    setExportingExcel(true);setErrorS13('')
    try {
      const {downloadRecordsExcel}=await import('./exportRecords.js')
      downloadRecordsExcel(draft,todayISO())
    } catch(error){console.error(error);setErrorS13('No se pudo exportar Excel. Volvé a intentarlo.')}
    finally{setExportingExcel(false)}
  }

  const generarS13 = async (yearOffset = 0) => {
    const setGenerando = yearOffset === -1 ? setGenerandoS13Anterior : setGenerandoS13
    setGenerando(true); setErrorS13('')
    try {
      const {generarS13Pdf,descargarBlob}=await import('./s13.js')
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
            <div className="admin-panel-brand">
              <span className="admin-panel-mark"><img src="logo-furgon.png" alt="" /></span>
              <span><strong className="admin-panel-title">Administración</strong><small>Gestión y organización</small></span>
            </div>
            <div className="admin-panel-hbtns">
              {view === 'registros' && <div className="admin-head-export">
                <button className="search-x" onClick={() => setExportOpen((v) => !v)} aria-label="Exportar" aria-expanded={exportOpen}>⋯</button>
                {exportOpen && <div className="admin-export-options">
                  <button className="admin-foot-btn" onClick={() => generarS13(0)} disabled={dirty || generandoS13 || generandoS13Anterior}>S-13 actual</button>
                  <button className="admin-foot-btn" onClick={() => generarS13(-1)} disabled={dirty || generandoS13 || generandoS13Anterior}>S-13 anterior</button>
                  <button className="admin-foot-btn" onClick={exportar} disabled={dirty || exportingExcel}>{exportingExcel?'Preparando…':'Excel'}</button>
                </div>}
              </div>}
              {view === 'registros' && <button className={'admin-head-save' + (dirty ? ' dirty' : '')} onClick={guardar} disabled={!dirty || saving} aria-label="Guardar cambios" title="Guardar cambios">{saving ? '…' : 'Guardar'}</button>}
              <button className="search-x" onClick={onMinimize} aria-label="Minimizar administración" title="Minimizar · volver desde Admin"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M5 18h14"/></svg></button>
              <button className="search-x" onClick={pedirCierre} aria-label="Cerrar">×</button>
            </div>
          </div>
        </div>

        <div className="admin-workspace">
          <nav className="admin-tabs" aria-label="Secciones de administración">
            <span className="admin-tabs-label">Gestión</span>
            <button className={view === 'registros' ? 'on' : ''} onClick={() => setView('registros')}><span className="admin-nav-icon"><IconList /></span><span>Registros</span></button>
            <button className={view === 'programa' ? 'on' : ''} onClick={() => setView('programa')}><span className="admin-nav-icon"><IconCalendar /></span><span className="tab-wide">Generar programa</span><span className="tab-short">Programa</span></button>
            <button className={view === 'otros' ? 'on' : ''} onClick={() => setView('otros')}><span className="admin-nav-icon"><IconAdmin /></span><span>Otros</span></button>
          </nav>
          <div className="admin-view" data-view={view} tabIndex={view==='registros'?0:undefined} style={{'--record-filters-height':`${filtersHeight}px`}} aria-label={view==='registros'?'Lista de registros':undefined}>
            {view === 'registros' && <div className="admin-panel-sub"><span className={'admin-sync-dot' + (dirty ? ' dirty' : '')} />{draft.length} registros · {saving ? 'guardando…' : dirty ? 'cambios sin guardar' : preview ? 'prueba local · sin escrituras a producción' : 'sincronizado'}</div>}
            {view === 'programa' ? <ProgramGenerator preview={preview} designPreview={designPreview} territories={data} minimized={minimized} onMinimize={onMinimize} /> : view === 'otros' ? <div className="admin-other-settings">
          <h2>Otros</h2>
          <ProgramWeekSettings value={programWeekStart} onSave={onProgramWeekStartChange} preview={preview}/>
          <SplashTypeSettings value={splashType} onSave={onSplashTypeChange} preview={preview}/>
          <div className="admin-record-tools">
            <div className="admin-public-settings">
              <div className="admin-campmode">
                <div><div className="admin-campmode-label">Modo campaña</div><div className="admin-campmode-sub">{campModoOn ? 'Visible y editable.' : 'Oculto para todos.'}</div></div>
                <div className="admin-campmode-actions">
                  <button className="admin-campaign-reset" disabled={saving || dirty || !draft.some((record) => record.campania)} onClick={restablecerCampania} title={dirty ? 'Guardá los cambios pendientes primero' : 'Quitar todas las marcas C'}>Restablecer</button>
                  <button className={'admin-switch' + (campModoOn ? ' on' : '')} disabled={saving} onClick={() => runRemote(() => onCampModoChange(!campModoOn))} aria-label="Mostrar modo campaña" aria-pressed={campModoOn}><span className="admin-switch-knob" /></button>
                </div>
              </div>
              <div className="admin-campmode">
                <div><div className="admin-campmode-label">Métrica pública</div><div className="admin-campmode-sub">{metricsVisible ? 'Visible sin iniciar sesión.' : 'Solo visible para administradores.'}</div></div>
                <button className={'admin-switch' + (metricsVisible ? ' on' : '')} disabled={saving} onClick={() => runRemote(() => onMetricsVisibleChange(!metricsVisible))} aria-label="Mostrar Métrica a usuarios públicos" aria-pressed={metricsVisible}><span className="admin-switch-knob" /></button>
              </div>
            </div>
          </div>
          {saveError&&<p role="alert" className="admin-save-error">{saveError}</p>}
          <AdminUsers currentEmail={currentEmail} onLogout={salir} preview={preview}/>
          </div> : <>
          <div className="admin-record-filters" ref={filtersRef}>
            <div className="admin-search"><IconSearch /><input type="text" inputMode="numeric" pattern="[0-9]*" aria-label="Filtrar por número de territorio" placeholder="Filtrar por N° de territorio" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <div className="admin-filtros">
            {FILTROS.map((f) => <button key={f.key} aria-pressed={filtro===f.key} className={'admin-filtro-btn' + (filtro === f.key ? ' on' : '')} onClick={() => setFiltro(f.key)}>{f.label}</button>)}
            {designPreview?<button type="button" className="admin-mini-btn primary" disabled={saving||!territoriosOrdenados.length} onClick={()=>{setEditingId(null);setNewRecord({id:`nuevo-${crypto.randomUUID()}`,territorio:territoriosOrdenados.find(t=>t===`T${q.replace(/\D/g,'')}`)||territoriosOrdenados[0],inicio:todayISO(),fin:null,campania:false,manzanasActivas:null,createdOrder:Date.now()})}}>+ Agregar registro</button>:<div className="admin-add-row"><input className={'admin-add-terr' + (errorTerr ? ' error' : '')} placeholder="T##" value={nuevoTerr} onChange={(e) => { setNuevoTerr(e.target.value); setErrorTerr(false) }} onKeyDown={(e) => e.key === 'Enter' && agregar()} /><button className="admin-mini-btn primary" onClick={agregar}><span className="desktop-label">+ Agregar fila</span><span className="mobile-label">+ Fila</span></button></div>}
          </div>
          </div>
          {errorTerr && <div className="admin-add-error">Ese territorio no existe.</div>}
          {editingRow && <RecordEditorSurface modal={designPreview} preview={preview} title={newRecord?'Agregar registro':`Editar ${editingRow.territorio}`} isNew={!!newRecord} saving={saving} onClose={closeEditor} onDone={finishEditor} onDelete={!newRecord?()=>eliminar(editingRow):undefined}>{designPreview?<RecordFields record={editingRow} territories={territoriosOrdenados} blocks={manzanasPorTerritorio[editingRow.territorio]||[]} campaignEnabled={campModoOn} saving={saving} onChange={(field,value)=>editar(editingRow,field,value)} onTerritory={value=>cambiarTerritorio(editingRow,value)} onBlock={number=>alternarManzana(editingRow,number)} />:<div className={'admin-editor-card' + (editingRow.inicio && !editingRow.fin ? ' activo' : '')}>
            <div className="admin-accordion-head">
              <strong>{newRecord?'Nuevo registro':`Editar ${editingRow.territorio}`}</strong>
              <div className="admin-accordion-actions">
                <button className="admin-row-done" onClick={finishEditor} aria-label="Terminar edición">✓</button>
                {!newRecord&&<button className="admin-mini-btn ghost danger" disabled={saving} onClick={() => eliminar(editingRow)}>Eliminar</button>}
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
          </div>}</RecordEditorSurface>}
          <div className="admin-table-wrap"><table className="admin-table">
            <caption className="record-table-caption">Registros de territorio <span>{visibles.length} {visibles.length===1?'registro':'registros'}</span></caption>
            <thead><tr><th scope="col">Terr.</th><th scope="col">Inicio</th><th scope="col">Fin</th><th scope="col">Campaña</th><th scope="col"><span className="record-sr-only">Editar</span></th></tr></thead>
            <tbody>
              {!visibles.length && <tr><td colSpan={5} className="admin-table-empty">Sin filas para este filtro.</td></tr>}
              {visibles.filter((f) => f.id !== editingId).map((f) => {
                return <tr key={f.id} className={f.inicio && !f.fin ? 'activo' : ''} onClick={() => setEditingId(f.id)}>
                  <td className="admin-table-terr" data-label="Territorio"><strong>{f.territorio}</strong></td>
                  <td data-label="Inicio"><time dateTime={f.inicio||undefined}>{fechaCorta(f.inicio)}</time></td>
                  <td data-label="Fin">{f.fin?<time dateTime={f.fin}>{fechaCorta(f.fin)}</time>:<span className={f.inicio?'record-started':'record-pending'}>{f.inicio?'Empezado':'Sin iniciar'}</span>}</td>
                  <td data-label="Campaña">{f.campania ? <span className="admin-c-badge">Campaña</span> : <span className="admin-c-empty">—</span>}</td>
                  <td className="admin-row-delete"><button className="admin-row-open" onClick={(e) => { e.stopPropagation(); setEditingId(f.id) }} aria-label={`Editar ${f.territorio}`}>›</button></td>
                </tr>
              })}
            </tbody>
          </table></div>
          {(errorS13 || saveError || syncError) && <div className="admin-export-error">{errorS13 || saveError || syncError}</div>}
            </>}
          </div>
        </div>
        {discardRequest&&<DiscardChangesDialog message={discardRequest.message} confirmLabel={discardRequest.confirmLabel} onCancel={()=>setDiscardRequest(null)} onConfirm={()=>{const action=discardRequest.action;setDiscardRequest(null);action()}}/>}
      </div>
    </div>
  )
}
