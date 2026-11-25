const productionHosts=new Set(['territorios-este-sf.web.app','territorios-este-sf.firebaseapp.com'])

// Fail closed: development, localhost, LAN previews and unknown hosts never write
// to the configured production database. This is a client-side accident guard,
// not a replacement for Firebase authentication or security rules.
export function productionWritesAllowed({development=false,hostname='',protocol=''}={}) {
  return !development&&protocol==='https:'&&productionHosts.has(String(hostname).toLowerCase())
}

export function assertProductionWritesAllowed(context) {
  if(productionWritesAllowed(context))return
  const error=new Error('Entorno de prueba: las escrituras a producción están bloqueadas. Los cambios locales no se envían a Firebase.')
  error.code='local-production-write-blocked'
  throw error
}
