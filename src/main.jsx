import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

const originalConsoleError = console.error;
console.error = (...args) => {
  // Filter out specific extension-related errors
  if (
    args[0]?.includes('extension') ||
    args[0]?.includes('background.js') ||
    args[0]?.includes('fido2') ||
    args[0]?.includes('Failed to fetch')
  ) {
    return;
  }
  originalConsoleError.apply(console, args);
};

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
