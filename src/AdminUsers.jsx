import { useEffect, useMemo, useState } from 'react'
import {
  addAdminEmail, bootstrapAdminEmail, removeAdminEmail, subscribeAdminEmails,
} from './firebaseData.js'

export default function AdminUsers({ currentEmail }) {
  const [admins, setAdmins] = useState([])
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const principal = bootstrapAdminEmail()
  const current = String(currentEmail || '').toLowerCase()

  useEffect(() => subscribeAdminEmails(setAdmins, (e) => {
    console.error(e)
    setError('No se pudo cargar la lista de administradores.')
  }), [])

  const rows = useMemo(() => {
    const list = admins.filter((a) => a.email !== principal)
    return principal ? [{ id: principal, email: principal, principal: true }, ...list] : list
  }, [admins, principal])

  const agregar = async (e) => {
    e.preventDefault(); setBusy(true); setError('')
    try { await addAdminEmail(email); setEmail('') }
    catch (err) { setError(err.message === 'invalid-email' ? 'Ingresá un correo válido.' : 'No se pudo agregar el administrador.') }
    finally { setBusy(false) }
  }

  const quitar = async (row) => {
    if (!window.confirm(`¿Quitar el acceso de ${row.email}?`)) return
    setBusy(true); setError('')
    try { await removeAdminEmail(row.email) }
    catch (err) { console.error(err); setError('No se pudo quitar el administrador.') }
    finally { setBusy(false) }
  }

  return (
    <div className="admin-users">
      <div className="admin-users-intro">
        <b>Administradores</b>
        <span>Las personas autorizadas ingresan con su cuenta de Google. Cualquier administrador puede agregar o quitar a otro.</span>
      </div>
      <form className="admin-users-add" onSubmit={agregar}>
        <input type="email" placeholder="correo@ejemplo.com" autoCapitalize="none" value={email} onChange={(e) => { setEmail(e.target.value); setError('') }} />
        <button className="admin-mini-btn primary" disabled={busy || !email.trim()}>Agregar</button>
      </form>
      {error && <div className="admin-users-error">{error}</div>}
      <div className="admin-users-list">
        {rows.map((row) => {
          const protectedRow = row.principal || row.email === current
          return <div className="admin-user-row" key={row.email}>
            <div><strong>{row.email}</strong><span>{row.principal ? 'Cuenta principal' : row.email === current ? 'Tu cuenta' : 'Administrador'}</span></div>
            <button className="admin-mini-btn ghost danger" disabled={busy || protectedRow} title={protectedRow ? 'Este acceso no se puede quitar desde aquí' : 'Quitar administrador'} onClick={() => quitar(row)}>Quitar</button>
          </div>
        })}
      </div>
    </div>
  )
}
