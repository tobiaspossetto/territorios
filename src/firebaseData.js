import {
  GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPopup, signOut,
} from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore'
import { firebaseAuth, firestore } from './firebase.js'

const ADMIN_EMAIL = (import.meta.env.VITE_FIREBASE_ADMIN_EMAIL || '').toLowerCase()

function assertFirebase() {
  if (!firebaseAuth || !firestore) throw new Error('Firebase no está configurado.')
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
  assertFirebase()
  const email = String(value || '').trim().toLowerCase()
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('invalid-email')
  await setDoc(doc(firestore, 'adminEmails', email), {
    email, active: true, updatedAt: Date.now(), updatedBy: firebaseAuth.currentUser?.email || '',
  }, { merge: true })
}

export async function removeAdminEmail(value) {
  assertFirebase()
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
  if (!firestore) { onData({ summaries: {}, campaignMode: false, metricsVisible: true }); return () => {} }
  let summaries = {}
  let campaignMode = false
  let metricsVisible = true
  const emit = () => onData({ summaries, campaignMode, metricsVisible })
  const stopTerr = onSnapshot(collection(firestore, 'territoriosPublicos'), (snap) => {
    summaries = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
    emit()
  }, onError)
  const stopConfig = onSnapshot(doc(firestore, 'config', 'public'), (snap) => {
    campaignMode = snap.exists() && snap.data().campaignMode === true
    // Por compatibilidad, las instalaciones que todavía no tengan este campo
    // mantienen la Métrica visible para todos.
    metricsVisible = !snap.exists() || snap.data().metricsVisible !== false
    emit()
  }, onError)
  return () => { stopTerr(); stopConfig() }
}

function summary(rows) {
  const completas = rows.filter((r) => r.inicio && r.fin)
  const now = new Date()
  const serviceYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1
  const vecesPorAnoServicio = completas.reduce((counts, record) => {
    const [year, month] = record.fin.split('-').map(Number)
    const key = String(month >= 9 ? year : year - 1)
    counts[key] = (counts[key] || 0) + 1
    return counts
  }, {})
  const ultima = completas.map((r) => r.fin).sort().slice(-1)[0] || null
  const primera = completas.map((r) => r.fin).sort()[0] || null
  const campania = rows.filter((r) => r.campania)
  const activa = rows.filter((r) => r.inicio && !r.fin).sort((a, b) => (b.createdOrder || 0) - (a.createdOrder || 0))[0]
  return {
    veces: completas.length,
    vecesServicio: vecesPorAnoServicio[String(serviceYear)] || 0,
    vecesPorAnoServicio,
    primera,
    ultima,
    activo: !!activa,
    campania: campania.length > 0,
    campaniaHecho: campania.length > 0 && campania.every((r) => !!r.inicio && !!r.fin),
    manzanasActivas: Array.isArray(activa?.manzanasActivas) ? activa.manzanasActivas.map(String) : null,
  }
}

async function recomputeTerritory(territorio) {
  if (!territorio) return
  const snap = await getDocs(query(collection(firestore, 'registros'), where('territorio', '==', territorio)))
  await setDoc(doc(firestore, 'territoriosPublicos', territorio), summary(snap.docs.map((d) => d.data())))
}

// Completa una sola vez los resúmenes públicos antiguos con los campos que
// necesita el mapa (estado activo y manzanas configuradas). Se ejecuta al
// entrar un administrador y queda registrada para no repetir escrituras.
export async function ensurePublicMapSummary(records) {
  assertFirebase()
  const migrationRef = doc(firestore, 'migrations', 'public-map-summary-v2')
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
  batch.set(migrationRef, { completedAt: Date.now(), version: 2 })
  await batch.commit()
}

export async function addRecord(territorio) {
  assertFirebase()
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
  assertFirebase()
  await updateDoc(doc(firestore, 'registros', record.id), { [field]: value, updatedAt: Date.now() })
  await recomputeTerritory(record.territorio)
  if (field === 'territorio' && value !== record.territorio) await recomputeTerritory(value)
}

export async function removeRecord(record) {
  assertFirebase()
  await deleteDoc(doc(firestore, 'registros', record.id))
  await recomputeTerritory(record.territorio)
}

// Guarda de una sola vez todos los cambios preparados en la tabla admin.
// Así editar un campo no modifica Firebase hasta pulsar "Guardar cambios".
export async function saveRecordChanges({ created = [], updated = [], deleted = [] }) {
  assertFirebase()
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
  assertFirebase()
  await setDoc(doc(firestore, 'config', 'public'), { campaignMode, updatedAt: Date.now() }, { merge: true })
}

export async function setMetricsVisible(metricsVisible) {
  assertFirebase()
  await setDoc(doc(firestore, 'config', 'public'), { metricsVisible, updatedAt: Date.now() }, { merge: true })
}

// Borrador privado y compartido del generador de programa.
export function subscribeProgramDraft(onData, onError) {
  assertFirebase()
  return onSnapshot(doc(firestore, 'config', 'programa'), (snap) => {
    const data = snap.exists() ? snap.data() : null
    onData(Array.isArray(data?.salidas) ? data.salidas : null)
  }, onError)
}

export async function saveProgramDraft(salidas) {
  assertFirebase()
  await setDoc(doc(firestore, 'config', 'programa'), {
    salidas,
    updatedAt: Date.now(),
    updatedBy: firebaseAuth.currentUser?.email || '',
  })
}

export function applyPublicSummaries(fc, summaries) {
  if (!fc || !summaries) return fc
  const now = Date.now()
  const current = new Date()
  const serviceYear = current.getMonth() >= 8 ? current.getFullYear() : current.getFullYear() - 1
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
          veces_servicio: s.vecesPorAnoServicio?.[String(serviceYear)] ?? s.vecesServicio ?? 0,
          primera: s.primera || null,
          ultima_fmt: s.ultima ? s.ultima.split('-').reverse().join('/') : 'sin registro',
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
