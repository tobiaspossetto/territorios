// Pantalla de carga / bienvenida: skyline + wordmark (estilo del logo de referencia).
export default function Splash({ out }) {
  return (
    <div className={'splash' + (out ? ' out' : '')}>
      <div className="splash-inner">
        <svg className="splash-mark" viewBox="0 0 200 88" fill="none"
          stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round">
          <g className="rays" strokeWidth="1.3">
            <path d="M100 78 L72 52 M100 78 L86 44 M100 78 L100 38 M100 78 L114 44 M100 78 L128 52" />
          </g>
          <path d="M55 78 H146" />
          <rect x="62" y="60" width="10" height="18" />
          <rect x="74" y="50" width="9" height="28" />
          <path d="M85 78 V44 L91 30 L97 44 V78 Z" />
          <rect x="99" y="54" width="10" height="24" />
          <rect x="111" y="48" width="9" height="30" />
          <rect x="122" y="62" width="12" height="16" />
        </svg>
        <div className="splash-title">TERRITORIOS</div>
        <div className="splash-sub">Cong Este SF</div>
      </div>
    </div>
  )
}
