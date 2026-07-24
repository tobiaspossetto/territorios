import { useState, useRef, useEffect } from 'react'
import { IconSearch } from './icons.jsx'

// Buscador de territorio por número. Botón grande (pulgar) -> hoja inferior con
// teclado numérico y sugerencias grandes tocables.
export default function Buscador({ data, onPick }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  if (!data) return null

  const close = () => { setOpen(false); setQ('') }

  // territorios ordenados por número; filtra por el número tipeado
  const nums = data.features
    .map((f) => ({ id: f.properties.territorio, zona: f.properties.zona, n: parseInt(String(f.properties.territorio).replace(/\D/g, ''), 10) }))
    .sort((a, b) => a.n - b.n)
  const dig = q.replace(/\D/g, '')
  const results = dig ? nums.filter((t) => String(t.n).startsWith(dig)) : nums

  const pick = (id) => { onPick(id); close() }

  return (
    <>
      <button className="search-fab" onClick={() => setOpen(true)} aria-label="Buscar territorio">
        <IconSearch />
        <span>Buscar N°</span>
      </button>

      {open && (
        <div className="search-sheet-bg" onClick={close}>
          <div className="search-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="search-grip" />
            <div className="search-head">
              <span>Buscar territorio</span>
              <button className="search-x" onClick={close} aria-label="Cerrar">×</button>
            </div>
            <input
              ref={inputRef} className="search-input" type="text" inputMode="numeric"
              pattern="[0-9]*" placeholder="N° de territorio (ej. 52)"
              value={q} onChange={(e) => setQ(e.target.value)}
            />
            <div className="search-list">
              {results.length === 0 && <div className="search-empty">No hay territorio con ese número.</div>}
              {results.map((t) => (
                <button key={t.id} className="search-item" onClick={() => pick(t.id)}>
                  <b>{t.id}</b>
                  <span>{t.zona}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
