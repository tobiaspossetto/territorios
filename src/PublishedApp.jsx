import App from './App.jsx'
import HubProgram from './HubProgram.jsx'
import './design-preview.css'
import './design-workspace.css'
import './design-program-editor.css'
import './palette-preview.css'
import './program-density-preview.css'

// Presentation only. Never enable previewDesign here: it selects fictitious data.
export default function PublishedApp() {
  return <App designUI ProgramView={HubProgram}/>
}
