import {AppDateField} from './DateTimeFields.jsx'

export default function RecordFields({record,territories,blocks,campaignEnabled,saving,onChange,onTerritory,onBlock}) {
  const active=Array.isArray(record.manzanasActivas)?record.manzanasActivas.map(String):blocks
  const today=new Date().toISOString().slice(0,10)
  return <div className="record-form">
    <div className="record-identity">
      <label className="record-territory"><span>Territorio</span><select value={record.territorio} disabled={saving} onChange={event=>onTerritory(event.target.value)}>{territories.map(t=><option key={t}>{t}</option>)}</select></label>
      <div className="record-campaign"><span>Campaña</span><button type="button" role="switch" aria-label="Registro de campaña" aria-checked={!!record.campania} disabled={!campaignEnabled||saving} onClick={()=>onChange('campania',!record.campania)}><i aria-hidden="true"/><span>{record.campania?'Sí':'No'}</span></button></div>
    </div>
    {!campaignEnabled&&<p className="record-field-hint">La campaña está desactivada en la app.</p>}
    <fieldset className="record-date-section"><legend>Fechas de trabajo</legend><div className="record-date-grid">
      <AppDateField label="Inicio" value={record.inicio||''} max={record.fin||today} disabled={saving} onChange={value=>onChange('inicio',value)} />
      <AppDateField label="Fin · opcional" value={record.fin||''} min={record.inicio||undefined} max={today} disabled={saving} onChange={value=>onChange('fin',value||null)} />
    </div><p className="record-field-hint">Dejá el fin vacío mientras el territorio esté empezado.</p></fieldset>
    {record.inicio&&!record.fin&&<fieldset className="record-blocks-section"><legend>Manzanas disponibles</legend><div className="record-blocks-head"><span>{active.length} de {blocks.length} seleccionadas</span><button type="button" disabled={saving||!blocks.length} onClick={()=>onChange('manzanasActivas',null)}>Seleccionar todas</button></div>
      <div className="record-blocks">{blocks.map(number=><button type="button" key={number} disabled={saving} aria-label={`Manzana ${number}`} aria-pressed={active.includes(number)} onClick={()=>onBlock(number)}><span aria-hidden="true">{active.includes(number)?'✓':'−'}</span>{number}</button>)}</div>
      <p className="record-field-hint">Las que desactives se verán tachadas en el mapa y no deben trabajarse.</p>
    </fieldset>}
  </div>
}
