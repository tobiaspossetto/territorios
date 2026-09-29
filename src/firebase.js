import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(firebaseConfig).every(Boolean)

// Sin configuración, el mapa público puede seguir usando sus GeoJSON estáticos;
// el acceso administrador simplemente queda deshabilitado.
export const firebaseApp = firebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : null

export const firebaseAuth = firebaseApp ? getAuth(firebaseApp) : null
export const firestore = firebaseApp ? getFirestore(firebaseApp) : null
