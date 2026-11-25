import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')
test('Registros y Programa comparten medidas compactas por breakpoint',()=>{
  const editor=source('design-program-editor.css'),css=source('design-workspace.css')
  assert.match(editor,/:is\(\.programa,\.record-form\) \{ --program-control-height:32px; --program-field-gap:4px/)
  assert.match(editor,/:is\(\.programa,\.record-form\) \{ --program-control-height:36px/)
  assert.match(css,/\.record-edit-dialog \.record-form :is\(select,\.aria-field-control\) \{[^}]*min-height:var\(--program-control-height\); height:var\(--program-control-height\)/)
  assert.match(css,/\.record-form \.aria-date-input \{ font-size:14px/)
})
test('editor nativo captura foco, soporta Escape y conserva el modo anterior',()=>{
  const code=source('RecordEditorSurface.jsx')
  assert.match(code,/node.showModal\(\)/)
  assert.match(code,/return\(\)=>node.close\(\)/)
  assert.match(code,/if\(!modal\)return children/)
  assert.match(code,/onCancel=/)
  assert.match(code,/aria-label=\{title\}/)
})
test('alta se prepara en un borrador aislado y nunca escribe remotamente al cerrar',()=>{
  const code=source('AdminPanelV2.jsx')
  assert.match(code,/const \[newRecord,setNewRecord\]=useState\(null\)/)
  assert.match(code,/markDirty\(\[\.\.\.draft,newRecord\]\)/)
  assert.match(code,/Descartar este nuevo registro/)
  assert.match(code,/modal=\{designPreview\}/)
  assert.match(code,/recordRequest.territorio/)
  assert.match(source('App.jsx'),/recordRequest=\{adminRecordRequest\}/)
})
test('formulario por secciones con etiquetas, estado de campaña y manzanas accesibles',()=>{
  const code=source('RecordFields.jsx')
  assert.match(code,/<legend>Fechas de trabajo<\/legend>/)
  assert.match(code,/<legend>Manzanas disponibles<\/legend>/)
  assert.match(code,/role="switch" aria-label="Registro de campaña" aria-checked=/)
  assert.match(code,/aria-pressed=\{active.includes\(number\)\}/)
  assert.match(code,/min=\{record.inicio\|\|undefined\} max=\{today\}/)
  assert.match(source('AdminPanelV2.jsx'),/<caption className="record-table-caption">/)
})
test('el atajo reanuda el registro empezado; sin él prepara un alta limpia',()=>{
  const code=source('AdminPanelV2.jsx')
  const effect=code.slice(code.indexOf('    if(!designPreview||!recordRequest'),code.indexOf('  const runRemote'))
  assert.match(effect,/startedTerritoryRecord\(dirty\?draft:registroBase,recordRequest.territorio\)/)
  assert.match(effect,/setNewRecord\(started\?null:\{id:`nuevo-/)
  assert.match(effect,/setEditingId\(started\?\.id\|\|null\)/)
  assert.match(effect,/!recordsReady/)
  assert.match(code,/onClick=\{\(\) => setEditingId\(f.id\)\}/)
})
test('el atajo se consume al abrirse y no sobrevive al cierre de Administración',()=>{
  const admin=source('AdminPanelV2.jsx'),app=source('App.jsx')
  const effect=admin.slice(admin.indexOf('    if(!designPreview||!recordRequest'),admin.indexOf('  const runRemote'))
  assert.match(effect,/onRecordRequestHandled\?\.\(recordRequest\)/)
  assert.match(app,/onRecordRequestHandled=\{consumeAdminRecordRequest\}/)
  assert.match(app,/setAdminRecordRequest\(current=>current===request\?null:current\)/)
  // Consuming an older request must not drop a newer shortcut click.
  const consume=(current,handled)=>current===handled?null:current
  const first={territorio:'T25'},next={territorio:'T31'}
  assert.equal(consume(first,first),null)
  assert.equal(consume(next,first),next)
})
