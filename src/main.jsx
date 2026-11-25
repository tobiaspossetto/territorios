import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import { REDESIGN_ENABLED } from './interfaceRelease.js'
import './index.css'
import './v2.css'
import PublishedApp from './PublishedApp.jsx'

// Shared presentation approved locally, including the published app.
import './jw-library-preview.css'

const RootView = REDESIGN_ENABLED ? PublishedApp : App

// Recargar una sola vez al cambiar de versión, también si otra pestaña
// activa el nuevo worker. La primera instalación no necesita recarga.
let reloading = false
const reloadForUpdate = () => {
  if (reloading) return
  reloading = true
  window.location.reload()
}
if ('serviceWorker' in navigator) {
  let hadController = Boolean(navigator.serviceWorker.controller)
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController) reloadForUpdate()
    hadController = Boolean(navigator.serviceWorker.controller)
  })
}

registerSW({
  immediate: true,
  onNeedReload: reloadForUpdate,
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    let checking = false
    let lastCheck = 0
    const checkUpdate = async () => {
      if (checking || !navigator.onLine || document.visibilityState !== 'visible') return
      if (Date.now() - lastCheck < 10_000) return
      checking = true
      lastCheck = Date.now()
      try { await registration.update() }
      catch (error) { console.warn('No se pudo comprobar la actualización:', error) }
      finally { checking = false }
    }
    checkUpdate()
    setInterval(checkUpdate, 60 * 1000)
    document.addEventListener('visibilitychange', checkUpdate)
    window.addEventListener('focus', checkUpdate)
    window.addEventListener('pageshow', checkUpdate)
    window.addEventListener('online', checkUpdate)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <React.Suspense fallback={<div>Cargando…</div>}><RootView /></React.Suspense>
  </React.StrictMode>,
)
