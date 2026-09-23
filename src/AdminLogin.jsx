import { useState } from 'react'
import { checkLogin, setAdminSession } from './adminData.js'
import { IconLock } from './icons.jsx'

// Login del modo admin. PoC: usuario/contraseña fijos (tobi/12345), sin
// backend — solo simula el paso "iniciar sesión" para probar el flujo.
export default function AdminLogin({ onSuccess, onClose }) {
  const [user, setUser] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState(false)

  const submit = (e) => {
    e.preventDefault()
    if (checkLogin(user, pass)) { setAdminSession(true); onSuccess() }
    else setError(true)
  }

  return (
    <div className="admin-bg" onClick={onClose}>
      <form className="admin-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="admin-card-icon"><IconLock /></div>
        <h2>Acceso admin</h2>
        <p className="admin-note">
          Prototipo local: este login y lo que cargues acá vive solo en este
          navegador, no se sincroniza con nadie todavía.
        </p>
        <input
          className="admin-input" placeholder="Usuario" autoFocus autoCapitalize="none"
          value={user} onChange={(e) => { setUser(e.target.value); setError(false) }}
        />
        <input
          className="admin-input" placeholder="Contraseña" type="password"
          value={pass} onChange={(e) => { setPass(e.target.value); setError(false) }}
        />
        {error && <div className="admin-error">Usuario o contraseña incorrectos.</div>}
        <button className="admin-btn" type="submit">Entrar</button>
        <button className="admin-cancel" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </div>
  )
}
