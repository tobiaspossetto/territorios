import {
  GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword,
  signInWithPopup, signOut,
} from 'firebase/auth'
import {
  addDoc, collection, deleteDoc, doc, getDocs, onSnapshot,
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

export function subscribeRecords(onData, onError) {
  assertFirebase()
  const q = query(collection(firestore, 'registros'), orderBy('createdOrder', 'asc'))
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  }, onError)
}

export function subscribePublicState(onData, onError) {
  if (!firestore) { onData({ summaries: {}, campaignMode: false }); return () => {} }
  let summaries = {}
  let campaignMode = false
  const emit = () => onData({ summaries, campaignMode })
  const stopTerr = onSnapshot(collection(firestore, 'territoriosPublicos'), (snap) => {
    summaries = Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
    emit()
  }, onError)
  const stopConfig = onSnapshot(doc(firestore, 'config', 'public'), (snap) => {
    campaignMode = snap.exists() && snap.data().campaignMode === true
    emit()
  }, onError)
  return () => { stopTerr(); stopConfig() }
}

function summary(rows) {
  const completas = rows.filter((r) => r.inicio && r.fin)
  const ultima = completas.map((r) => r.fin).sort().slice(-1)[0] || null
  const campania = rows.filter((r) => r.campania)
  return {
    veces: completas.length,
    ultima,
    campania: campania.length > 0,
    campaniaHecho: campania.length > 0 && campania.every((r) => !!r.inicio && !!r.fin),
  }
}

async function recomputeTerritory(territorio) {
  if (!territorio) return
  const snap = await getDocs(query(collection(firestore, 'registros'), where('territorio', '==', territorio)))
  await setDoc(doc(firestore, 'territoriosPublicos', territorio), summary(snap.docs.map((d) => d.data())))
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

export function applyPublicSummaries(fc, summaries) {
  if (!fc || !summaries) return fc
  const now = Date.now()
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
          ultima_fmt: s.ultima ? s.ultima.split('-').reverse().join('/') : 'sin registro',
          dias_desde: dias,
          campania: !!s.campania,
          campania_hecho: !!s.campaniaHecho,
        },
      }
    }),
  }
}
