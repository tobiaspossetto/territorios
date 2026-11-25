import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync,readdirSync} from 'node:fs'
import {productionWritesAllowed,assertProductionWritesAllowed} from '../src/firebaseWritePolicy.js'
const source=file=>readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8')

test('localhost, IPs, desarrollo y previews nunca habilitan escrituras a producción',()=>{
  const blocked=['localhost','127.0.0.1','127.0.0.2','[::1]','::1','0.0.0.0','192.168.1.5','10.0.0.2','172.16.0.5','equipo.local','territorios-este-sf--prueba.web.app','example.com','territorios-este-sf.web.app.example.com']
  for(const hostname of blocked)for(const development of [false,true]) {
    const context={hostname,development,protocol:'https:'}
    assert.equal(productionWritesAllowed(context),false,hostname)
    let writes=0
    assert.throws(()=>{assertProductionWritesAllowed(context);writes++},{code:'local-production-write-blocked'})
    assert.equal(writes,0)
  }
  assert.equal(productionWritesAllowed(),false)
  assert.equal(productionWritesAllowed({development:true,hostname:'territorios-este-sf.web.app',protocol:'https:'}),false)
})
test('solo la publicación oficial HTTPS habilita el flujo existente',()=>{
  for(const hostname of ['territorios-este-sf.web.app','territorios-este-sf.firebaseapp.com']) {
    const context={development:false,hostname,protocol:'https:'}
    assert.equal(productionWritesAllowed(context),true)
    assert.doesNotThrow(()=>assertProductionWritesAllowed(context))
    assert.equal(productionWritesAllowed({...context,protocol:'http:'}),false)
  }
})
test('todas las operaciones de escritura se protegen antes de llamar al SDK',()=>{
  const code=source('firebaseData.js')
  const mutations=['addAdminEmail','removeAdminEmail','recomputeTerritory','ensurePublicMapSummary','addRecord','updateRecord','removeRecord','saveRecordChanges','setCampaignMode','setMetricsVisible','setProgramWeekStart','setSplashType','saveProgramDraft','saveAssignmentPosition']
  for(const name of mutations) {
    const start=code.indexOf(`function ${name}(`)
    assert.ok(start>=0,name)
    const block=code.slice(start,start+330)
    const guard=block.indexOf('assertWritableFirebase()')
    assert.ok(guard>=0,`${name}: falta protección`)
    const sdk=block.search(/\b(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction|doc|getDocs)\(/)
    assert.ok(sdk<0||guard<sdk,`${name}: protección posterior al SDK`)
  }
  assert.match(code,/function assertWritableFirebase\(\) \{\s*assertFirebaseWritable\(\)/)
  assert.match(code,/function ensurePublicMapSummary\(records\) \{\s*if\(firebaseWritesBlocked\)return/)
  const files=readdirSync(new URL('../src/',import.meta.url)).filter(file=>/\.[jt]sx?$/.test(file)&&file!=='firebaseData.js')
  for(const file of files)assert.doesNotMatch(source(file),/import\s*\{[^}]*\b(?:setDoc|updateDoc|deleteDoc|addDoc|writeBatch|runTransaction)\b[^}]*\}\s*from\s*['"]firebase\/firestore['"]/s,file)
})
test('localhost entra automáticamente en simulación y lo indica en el encabezado',()=>{
  const code=source('App.jsx')
  assert.match(code,/const localSandbox=firebaseWritesBlocked/)
  assert.match(code,/const adminPreview = designPreview \|\| localSandbox \|\|/)
  assert.match(code,/const guidePreview = designPreview \|\| localSandbox \|\|/)
  assert.match(code,/localSandbox\?'Prueba local'/)
  assert.match(code,/onSave=\{adminPreview \? async/)
  assert.match(source('firebase.js'),/development:import.meta.env.DEV,hostname:window.location.hostname,protocol:window.location.protocol/)
})
