import React from 'react'
import ReactDOM from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App.jsx'
import './index.css'

// Al detectar versión nueva: aplicarla y recargar solo (sin recarga manual).
// Offline sigue funcionando con lo cacheado.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() { updateSW(true) },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
