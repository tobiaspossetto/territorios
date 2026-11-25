import {
  GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPopup, signOut,
} from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, getDocFromServer, getDocsFromServer, onSnapshot,
  orderBy, query, runTransaction, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { firebaseAuth, firestore, firebaseWritesBlocked, assertFirebaseWritable } from './firebase.js'
import { buildPublicProgramAssignments, validPinCoordinates, firstProgramTerritory } from './programAssignments.js'
import { mergeProgramDraft } from './programDraftMerge.js'
import {metricServiceYear, serviceCompletionCount} from './metricFrequency.js'
import {lastTerritoryVisit} from './lastTerritoryVisit.js'
import {normalizeProgramWeekStart} from './programWeeks.js'
import {normalizeSplashType} from './splashType.js'
import {readPublicStateCache,writePublicStateCache} from './publicStateCache.js'

const ADMIN_EMAIL = (import.meta.env.VITE_FIREBASE_ADMIN_EMAIL || '').toLowerCase()

function assertFirebase() {
  if (!firebaseAuth || !firestore) throw new Error('Firebase no está configurado.')
}

function assertWritableFirebase() {
  assertFirebaseWritable()
  assertFirebase()
}

export function observeAuth(callback) {
  if (!firebaseAuth) { callback(null); return () => {} }
  return onAuthStateChanged(firebaseAuth, callback)
}

export function loginGoogle() {
  assertFirebase()
  return signInWithPopup(firebaseAuth, new GoogleAuthProvider())
}

export function loginEmail(email, password) {
  assertFirebase()
  return signInWithEmailAndPassword(firebaseAuth, email, password)
}

export function logoutFirebase() {
  assertFirebase()
  return signOut(firebaseAuth)
}

export function isBootstrapAdmin(user) {
  return !!user && !!ADMIN_EMAIL && String(user.email || '').toLowerCase() === ADMIN_EMAIL
}

export function bootstrapAdminEmail() {
  return ADMIN_EMAIL
}

export async function isAuthorizedAdmin(user) {
  if (isBootstrapAdmin(user)) return true
  if (!user || !firestore) return false
  const email = String(user.email || '').trim().toLowerCase()
  try {
    if (email) {
      const byEmail = await getDoc(doc(firestore, 'adminEmails', email))
      if (byEmail.exists() && byEmail.data().active === true) return true
    }
    // Compatibilidad durante la migración con permisos antiguos por UID.
    const byUid = await getDoc(doc(firestore, 'admins', user.uid))
    return byUid.exists() && byUid.data().active === true
  } catch (error) {
    console.error('Validación de administrador:', error)
    return false
  }
}

export function subscribeAdminEmails(onData, onError) {
  assertFirebase()
  const q = query(collection(firestore, 'adminEmails'), orderBy('email', 'asc'))
  return onSnapshot(q, (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onError)
}

export async function addAdminEmail(value) {
  assertWritableFirebase()
  const email = String(value || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid-email')
  await setDoc(doc(firestore, 'adminEmails', email), {
    email, active: true, updatedAt: Date.now(), updatedBy: firebaseAuth.currentUser?.email || '',
  }, { merge: true })
}

export async function removeAdminEmail(value) {
  assertWritableFirebase()
  const email = String(value || '').trim().toLowerCase()
  await deleteDoc(doc(firestore, 'adminEmails', email))
}

export function subscribeRecords(onData, onError) {
  assertFirebase()
  const q = query(collection(firestore, 'registros'), orderBy('createdOrder', 'asc'))
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, onError)
}

export function subscribePublicState(onData, onError) {
  if (!firestore) { onData({ summaries: {}, campaignMode: false, metricsVisible: true, programAssignments: [], programWeekStart: 0, splashType:'collage' }); return () => {} }
  const cacheKey=`territorios-public-v1:${import.meta.env.VITE_FIREBASE_PROJECT_ID}`
  const cached=readPublicStateCache(cacheKey)
  let summaries = cached?.summaries || {}
  let campaignMode = cached?.campaignMode === true
  let metricsVisible = cached?.metricsVisible !== false
  let programAssignments = cached?.programAssignments || []
  let programWeekStart = normalizeProgramWeekStart(cached?.programWeekStart)
  let splashType = normalizeSplashType(cached?.splashType)
  let configReady = !!cached
  let stopped=false,refreshing=false,serverRevision=0
  const territoriesRef=collection(firestore,'territoriosPublicos')
  const configRef=doc(firestore,'config','public')
  // Las banderas no dependen de terminar la consulta de todos los registros.
  const emit = () => {
    if(!configReady)return
    const state={summaries,campaignMode,metricsVisible,programAssignments,programWeekStart,splashType}
    writePublicStateCache(cacheKey,state)
    onData(state)
  }
  // Restore before starting the network listeners, including a cold offline start.
  if(cached)onData({summaries,campaignMode,metricsVisible,programAssignments,programWeekStart,splashType})
  const applyConfig=snap=>{
    const value=snap.data()
    campaignMode=value?.campaignMode===true
    metricsVisible=value?.metricsVisible!==false
    programAssignments=Array.isArray(value?.programAssignments)?value.programAssignments:[]
    programWeekStart=normalizeProgramWeekStart(value?.programWeekStart)
    splashType=normalizeSplashType(value?.splashType)
    configReady=true
  }
  const stopTerr = onSnapshot(territoriesRef, {includeMetadataChanges:true}, (snap) => {
    // An empty SDK memory cache is not a deletion of the last public snapshot.
    if(snap.metadata.fromCache&&snap.empty)return
    if(!snap.metadata.fromCache)serverRevision++
    summaries = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
    emit()
  }, onError)
  const stopConfig = onSnapshot(configRef, {includeMetadataChanges:true}, (snap) => {
    if(snap.metadata.fromCache&&!snap.exists())return
    if(!snap.metadata.fromCache)serverRevision++
    applyConfig(snap)
    emit()
  }, onError)
  const refresh=async()=>{
    if(stopped||refreshing||document.hidden||!navigator.onLine)return
    refreshing=true
    const revision=serverRevision
    try {
      const [territories,config]=await Promise.all([getDocsFromServer(territoriesRef),getDocFromServer(configRef)])
      // A newer live snapshot takes precedence over an earlier refresh request.
      if(stopped||revision!==serverRevision)return
      summaries=Object.fromEntries(territories.docs.map(record=>[record.id,record.data()]))
      applyConfig(config)
      emit()
    } catch { /* Keep the last public copy until a server can be reached. */ }
    finally {refreshing=false}
  }
  window.addEventListener('online',refresh)
  window.addEventListener('focus',refresh)
  document.addEventListener('visibilitychange',refresh)
  return () => {
    stopped=true;stopTerr();stopConfig()
    window.removeEventListener('online',refresh)
    window.removeEventListener('focus',refresh)
    document.removeEventListener('visibilitychange',refresh)
  }
}

// One-shot, read-only copy for local QA. Never invokes migrations or record writes.
export async function readPublicMetricSnapshot() {
  assertFirebase()
  const snap = await getDocs(collection(firestore, 'territoriosPublicos'))
  return Object.fromEntries(snap.docs.map(d => [d.id, d.data()]))
}

function summary(rows) {
  const completas = rows.filter((r) => r.inicio && r.fin)
  const now = new Date()
  const serviceYear = metricServiceYear(now)
  const vecesPorAnoServicio = completas.reduce((counts, record) => {
    const [year, month] = record.fin.split('-').map(Number)
    const key = String(month >= 9 ? year : year - 1)
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})
  const ultima = completas.map((r) => r.fin).sort().slice(-1)[0] || null
  const primera = completas.map((r) => r.fin).sort()[0] || null
  const primeraInicio = completas.map((r) => r.inicio).sort()[0] || null
  const campania = rows.filter((r) => r.campania)
  const activa = rows.filter((r) => r.inicio && !r.fin).sort((a, b) => (b.createdOrder || 0) - (a.createdOrder || 0))[0]
  return {
    veces: completas.length,
    vecesServicio: vecesPorAnoServicio[String(serviceYear)] || 0,
    vecesPorAnoServicio,
    primera,
    primeraInicio,
    ultima,
    ultimaVisita: lastTerritoryVisit(rows),
    activo: !!activa,
    campania: campania.length > 0,
    campaniaHecho: campania.length > 0 && campania.every((r) => !!r.inicio && !!r.fin),
    manzanasActivas: Array.isArray(activa?.manzanasActivas) ? activa.manzanasActivas.map(String) : null,
  }
}

async function recomputeTerritory(territorio) {
  assertWritableFirebase()
  if (!territorio) return
  const snap = await getDocs(query(collection(firestore, 'registros'), where('territorio', '==', territorio)))
  await setDoc(doc(firestore, 'territoriosPublicos', territorio), summary(snap.docs.map((d) => d.data())))
}

// Completa una sola vez los resúmenes públicos antiguos con los campos que
// necesita el mapa, incluida la última visita empezada. Se ejecuta al
// entrar un administrador y queda registrada para no repetir escrituras.
export async function ensurePublicMapSummary(records) {
  if(firebaseWritesBlocked)return
  assertWritableFirebase()
  const migrationRef = doc(firestore, 'migrations', 'public-map-summary-v3')
  if ((await getDoc(migrationRef)).exists()) return
  const grouped = new Map()
  for (const record of records || []) {
    if (!record.territorio) continue
    if (!grouped.has(record.territorio)) grouped.set(record.territorio, [])
    grouped.get(record.territorio).push(record)
  }
  const batch = writeBatch(firestore)
  for (const [territorio, rows] of grouped) {
    batch.set(doc(firestore, 'territoriosPublicos', territorio), summary(rows))
  }
  batch.set(migrationRef, { completedAt: Date.now(), version: 3 })
  await batch.commit()
}

export async function addRecord(territorio) {
  assertWritableFirebase()
  await addDoc(collection(firestore, 'registros'), {
    territorio,
    inicio: new Date().toISOString().slice(0, 10),
    fin: null,
    campania: false,
    createdOrder: Date.now(),
    updatedAt: Date.now(),
  })
  await recomputeTerritory(territorio)
}

export async function updateRecord(record, field, value) {
  assertWritableFirebase()
  await updateDoc(doc(firestore, 'registros', record.id), { [field]: value, updatedAt: Date.now() })
  await recomputeTerritory(record.territorio)
  if (field === 'territorio' && value !== record.territorio) await recomputeTerritory(value)
}

export async function removeRecord(record) {
  assertWritableFirebase()
  await deleteDoc(doc(firestore, 'registros', record.id))
  await recomputeTerritory(record.territorio)
}

// Guarda de una sola vez todos los cambios preparados en la tabla admin.
// Así editar un campo no modifica Firebase hasta pulsar "Guardar cambios".
export async function saveRecordChanges({ created = [], updated = [], deleted = [] }) {
  assertWritableFirebase()
  const batch = writeBatch(firestore)
  const affected = new Set()

  created.forEach((record, index) => {
    const ref = doc(collection(firestore, 'registros'))
    const now = Date.now() + index
    batch.set(ref, {
      territorio: record.territorio,
      inicio: record.inicio || '',
      fin: record.fin || null,
      campania: !!record.campania,
      manzanasActivas: Array.isArray(record.manzanasActivas) ? record.manzanasActivas.map(String) : null,
      createdOrder: record.createdOrder || now,
      updatedAt: now,
    })
    affected.add(record.territorio)
  })

  updated.forEach(({ record, previousTerritorio }) => {
    batch.update(doc(firestore, 'registros', record.id), {
      territorio: record.territorio,
      inicio: record.inicio || '',
      fin: record.fin || null,
      campania: !!record.campania,
      manzanasActivas: Array.isArray(record.manzanasActivas) ? record.manzanasActivas.map(String) : null,
      updatedAt: Date.now(),
    })
    affected.add(record.territorio)
    affected.add(previousTerritorio)
  })

  deleted.forEach((record) => {
    batch.delete(doc(firestore, 'registros', record.id))
    affected.add(record.territorio)
  })

  await batch.commit()
  await Promise.all([...affected].filter(Boolean).map(recomputeTerritory))
}

export async function setCampaignMode(campaignMode) {
  assertWritableFirebase()
  await setDoc(doc(firestore, 'config', 'public'), { campaignMode, updatedAt: Date.now() }, { merge: true })
}

export async function setMetricsVisible(metricsVisible) {
  assertWritableFirebase()
  await setDoc(doc(firestore, 'config', 'public'), { metricsVisible, updatedAt: Date.now() }, { merge: true })
}

export async function setProgramWeekStart(programWeekStart) {
  assertWritableFirebase()
  if (normalizeProgramWeekStart(programWeekStart) !== programWeekStart) throw new Error('invalid-week-start')
  await setDoc(doc(firestore, 'config', 'public'), {programWeekStart, updatedAt:Date.now()}, {merge:true})
}

export async function setSplashType(splashType) {
  assertWritableFirebase()
  if(!['auto','collage'].includes(splashType))throw new Error('invalid-splash-type')
  await setDoc(doc(firestore,'config','public'),{splashType,updatedAt:Date.now()},{merge:true})
}

// Borrador privado y compartido del generador de programa.
export function subscribeProgramDraft(onData, onError) {
  assertFirebase()
  return onSnapshot(doc(firestore, 'config', 'programa'), (snap) => {
    const data = snap.exists() ? snap.data() : null
    onData(Array.isArray(data?.salidas) ? data.salidas : null)
  }, onError)
}

export async function saveProgramDraft(salidas, baseSalidas = salidas) {
  assertWritableFirebase()
  await runTransaction(firestore, async transaction => {
    const ref=doc(firestore,'config','programa')
    const snapshot=await transaction.get(ref)
    const updated=mergeProgramDraft(snapshot.data()?.salidas||[],salidas,baseSalidas)
    transaction.set(ref, {
      salidas:updated,
      updatedAt:Date.now(),
      updatedBy:firebaseAuth.currentUser?.email||'',
    })
    transaction.set(doc(firestore,'config','public'),{programAssignments:buildPublicProgramAssignments(updated),updatedAt:Date.now()},{merge:true})
  })
}

export async function saveAssignmentPosition(assignment, coordinates, { expectedCoordinates } = {}) {
  assertWritableFirebase()
  if (!validPinCoordinates(coordinates)) throw new Error('Ubicación inválida')
  await runTransaction(firestore, async transaction => {
    const ref = doc(firestore, 'config', 'programa')
    const snapshot = await transaction.get(ref)
    const salidas = snapshot.data()?.salidas || []
    let found = false
    const updated = salidas.map((salida, si) => ({
      ...salida,
      detalles: (salida.detalles || []).map((detalle, di) => {
        if (String(salida.id || si) !== assignment.salidaId || String(detalle.id || di) !== assignment.detalleId) return detalle
        if (firstProgramTerritory(detalle.territorio) !== assignment.territorio) throw new Error('La salida cambió. Intentá nuevamente.')
        if (expectedCoordinates && (!validPinCoordinates(detalle.pinCoordinates) || detalle.pinCoordinates.some((value, index) => Math.abs(value - expectedCoordinates[index]) > 1e-9))) {
          throw new Error('El pin cambió después de tu movimiento. No se modificó su posición.')
        }
        found = true
        return { ...detalle, pinCoordinates: coordinates, pinStatus: 'manual' }
      }),
    }))
    if (!found) throw new Error('Abrí Programa una vez para actualizar estas salidas antes de moverlas.')
    transaction.set(ref, { salidas: updated, updatedAt: Date.now(), updatedBy: firebaseAuth.currentUser?.email || '' }, { merge: true })
    transaction.set(doc(firestore, 'config', 'public'), { programAssignments: buildPublicProgramAssignments(updated), updatedAt: Date.now() }, { merge: true })
  })
}

export function applyPublicSummaries(fc, summaries) {
  if (!fc || !summaries) return fc
  const now = Date.now()
  const current = new Date()
  return {
    ...fc,
    features: fc.features.map((feature) => {
      const p = feature.properties
      const s = summaries[p.territorio]
      if (!s) return feature
      const dias = s.ultima ? Math.max(0, Math.floor((now - new Date(`${s.ultima}T00:00:00`).getTime()) / 86400000)) : null
      return {
        ...feature,
        properties: {
          ...p,
          veces: s.veces || 0,
          veces_servicio: serviceCompletionCount(s, current),
          primera: s.primera || null,
          primera_inicio: s.primeraInicio || null,
          ultima_fmt: s.ultima ? s.ultima.split('-').reverse().join('/') : 'sin registro',
          ultima_visita_fmt: (s.ultimaVisita || s.ultima)?.split('-').reverse().join('/') || 'Sin registro',
          dias_desde: dias,
          activo: s.activo === true,
          campania: !!s.campania,
          campania_hecho: !!s.campaniaHecho,
          manzanas_activas: Array.isArray(s.manzanasActivas) ? s.manzanasActivas.map(String) : null,
        },
      }
    }),
  }
}
