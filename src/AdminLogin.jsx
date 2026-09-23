import { useState } from 'react'
import { isBootstrapAdmin, loginEmail, loginGoogle, logoutFirebase } from './firebaseData.js'
import { IconLock } from './icons.jsx'

function friendlyError(error) {
  const code = error && error.code
  if (code === 'auth/popup-closed-by-user') return 'Se cerró el acceso de Google antes de terminar.'
  if (code === 'auth/invalid-credential') return 'Correo o contraseña incorrectos.'
  if (code === 'auth/unauthorized-domain') return 'Este dominio todavía no está autorizado en Firebase.'
  return 'No se pudo iniciar sesión. Revisá la conexión e intentá nuevamente.'
}

export default function AdminLogin({ onSuccess, onClose }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const run = async (action) => {
    setBusy(true); setError('')
    try {
      const result = await action()
      if (!isBootstrapAdmin(result.user)) {
        await logoutFirebase()
        setError('Esta cuenta no tiene permiso de administrador.')
        return
      }
      onSuccess(result.user)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const submit = (e) => {
    e.preventDefault()
    run(() => loginEmail(email.trim(), pass))
  }

  return (
    <div className="admin-bg" onClick={onClose}>
      <form className="admin-card" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="admin-card-icon"><IconLock /></div>
        <h2>Acceso admin</h2>
        <p className="admin-note">Ingresá con la cuenta autorizada. Los registros están protegidos y se sincronizan mediante Firebase.</p>
        <button className="admin-btn google" type="button" disabled={busy} onClick={() => run(loginGoogle)}>
          Continuar con Google
        </button>
        <div className="admin-separator"><span>o con correo</span></div>
        <input
          className="admin-input" placeholder="Correo electrónico" type="email" autoFocus autoCapitalize="none"
          value={email} onChange={(e) => { setEmail(e.target.value); setError('') }}
        />
        <input
          className="admin-input" placeholder="Contraseña" type="password"
          value={pass} onChange={(e) => { setPass(e.target.value); setError('') }}
        />
        {error && <div className="admin-error">{error}</div>}
        <button className="admin-btn" type="submit" disabled={busy || !email || !pass}>
          {busy ? 'Ingresando…' : 'Entrar'}
        </button>
        <button className="admin-cancel" type="button" onClick={onClose}>Cancelar</button>
      </form>
    </div>
  )
}
