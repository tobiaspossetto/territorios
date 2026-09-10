import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Al detectar versión nueva: aplicarla y recargar solo (sin recarga manual).
// Offline sigue funcionando con lo cacheado.
// El chequeo de "hay versión nueva" solo ocurre al registrar el SW (o sea, al
// abrir/recargar la página) -> si alguien deja la app abierta sin cerrarla,
// nunca se entera de un deploy nuevo. Se agrega un chequeo periódico para que
// la actualización llegue sola aunque no la vuelvan a abrir.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
  onRegisteredSW(swUrl, registration) {
    if (!registration) return
    setInterval(() => { registration.update() }, 60 * 1000)
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
