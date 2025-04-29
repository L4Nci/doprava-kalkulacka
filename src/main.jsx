import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

// Registrace service workeru
const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('Nová verze je k dispozici. Chcete aktualizovat?')) {
      updateSW()
    }
  },
  onOfflineReady() {
    console.log('Aplikace je připravena pro offline použití')
  },
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
