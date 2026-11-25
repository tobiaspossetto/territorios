import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const source=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')
test('descartar registros o cerrar/salir con cambios se confirma dentro de la app',()=>{
  const code=source('AdminPanelV2.jsx')
  assert.doesNotMatch(code,/window.confirm\('(¿Descartar este nuevo registro|Hay cambios sin guardar)/)
  for(const label of ['Descartar registro','Descartar y cerrar','Descartar y salir'])assert.ok(code.includes(label))
  assert.match(code,/onCancel=\{\(\)=>setDiscardRequest\(null\)\}/)
  assert.match(code,/setDiscardRequest\(null\);action\(\)/)
})
test('diálogo accesible con foco inicial seguro y Escape que conserva el borrador',()=>{
  const code=source('DiscardChangesDialog.jsx')
  assert.match(code,/node.showModal\(\)/)
  assert.match(code,/autoFocus onClick=\{onCancel\}>Seguir editando/)
  assert.match(code,/onCancel=\{event=>\{event.preventDefault\(\);onCancel\(\)\}\}/)
  assert.match(code,/aria-labelledby="discard-changes-title" aria-describedby="discard-changes-description"/)
})
