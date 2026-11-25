export function normalizeSplashType(value) {
  return value==='auto' ? 'auto' : 'collage'
}

export function readStartupSplashType(storage) {
  try { return normalizeSplashType((storage||globalThis.localStorage).getItem('startup-splash-type')) }
  catch { return 'collage' }
}

export function rememberSplashType(value,storage) {
  try { (storage||globalThis.localStorage).setItem('startup-splash-type',normalizeSplashType(value)) }
  catch { /* Storage restrictions must not block startup. */ }
}
