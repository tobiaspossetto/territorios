// Pantalla de carga / bienvenida: skyline + wordmark (estilo del logo de referencia).
export default function Splash({ out }) {
  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="splash-inner">
        <img className="splash-mark" src="logo-furgon.png" alt="" />
        <div className="splash-title">TERRITORIOS</div>
        <div className="splash-sub">Cong Este SF</div>
      </div>
    </div>
  )
}
