import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'
import { oneSignalService } from './services/oneSignalService'

// Initialize OneSignal
oneSignalService.init()

// Suppress harmless browser extension errors
if (typeof window !== 'undefined') {
  const originalError = console.error
  console.error = (...args: any[]) => {
    // Filter out browser extension errors
    const message = args[0]?.toString() || ''
    if (
      message.includes('runtime.lastError') ||
      message.includes('message port closed') ||
      message.includes('Could not establish connection') ||
      message.includes('Receiving end does not exist')
    ) {
      // Silently ignore browser extension errors
      return
    }
    originalError.apply(console, args)
  }

  // Also suppress unhandled errors from extensions
  window.addEventListener('error', (event) => {
    const message = event.message || ''
    if (
      message.includes('runtime.lastError') ||
      message.includes('message port closed') ||
      message.includes('Could not establish connection')
    ) {
      event.preventDefault()
      event.stopPropagation()
    }
  }, true)
}

// Initialize auth state
useAuthStore.getState().initialize()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

