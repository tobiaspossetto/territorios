import { Component, lazy, Suspense } from 'react'

const loadPanel = () => import('./AdminPanelV2.jsx')

// Keep the map mounted if a deferred download or an editor fails.
export default class AdminPanelLoader extends Component {
  state = { error: null, Panel: lazy(loadPanel) }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error) { console.error('No se pudo abrir Administración:', error) }
  retry = () => this.setState({ error:null, Panel:lazy(loadPanel) })
  render() {
    if(this.state.error) return <div className="admin-panel-bg"><section className="admin-load-error" role="alert">
      <strong>No se pudo abrir Administración</strong>
      <p>El mapa sigue disponible. Intentá abrir el panel nuevamente.</p>
      <div><button type="button" onClick={this.props.onClose}>Volver al mapa</button><button type="button" onClick={this.retry}>Reintentar</button></div>
    </section></div>
    const Panel = this.state.Panel
    return <Suspense fallback={this.props.fallback}><Panel {...this.props} /></Suspense>
  }
}
