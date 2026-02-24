import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { useAuthStore } from './store/authStore'
import { oneSignalService } from './services/oneSignalService'

// Initialize OneSignal
oneSignalService.init()

// Initialize Capacitor Google Auth if on native
import { Capacitor } from '@capacitor/core'
if (Capacitor.isNativePlatform()) {
  import('@codetrix-studio/capacitor-google-auth').then(({ GoogleAuth }) => {
    GoogleAuth.initialize({
      clientId: '899272110972-pjfti5ug438ubliit4ri5civ6nuhkftv.apps.googleusercontent.com',
      scopes: ['profile', 'email'],
    });
  });
}


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
      message.includes('Receiving end does not exist') ||
      message.includes('ERR_BLOCKED_BY_CLIENT')
    ) {
      // Silently ignore browser extension and block errors
      return
    }
    originalError.apply(console, args)
  }

  // Catch unhandled rejections from SDKs (like OneSignal or Firebase)
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason?.toString() || ''
    if (
      reason.includes('indexedDB') ||
      reason.includes('QuotaExceededError') ||
      reason.includes('UnknownError') ||
      reason.includes('backing store')
    ) {
      // These are usually storage restriction errors we can't fix but want to ignore
      event.preventDefault()
      event.stopPropagation()
    }
  })

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

