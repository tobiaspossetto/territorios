export default function SplashProgress({complete=false}) {
  return <div className={`collage-progress${complete?' is-complete':''}`} role="progressbar" aria-label="Cargando la aplicación" aria-valuemin={0} aria-valuemax={100} aria-valuenow={complete?100:undefined} aria-valuetext={complete?'Carga completa':'Cargando datos y mapa'}><span/></div>
}
