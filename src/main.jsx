// Polyfill Map.prototype.getOrInsertComputed and WeakMap.prototype.getOrInsertComputed for older/mobile browsers
if (!Map.prototype.getOrInsertComputed) {
  Object.defineProperty(Map.prototype, 'getOrInsertComputed', {
    value: function (key, callback) {
      if (this.has(key)) {
        return this.get(key)
      }
      const value = callback(key)
      this.set(key, value)
      return value
    },
    writable: true,
    configurable: true,
  })
}

if (!WeakMap.prototype.getOrInsertComputed) {
  Object.defineProperty(WeakMap.prototype, 'getOrInsertComputed', {
    value: function (key, callback) {
      if (this.has(key)) {
        return this.get(key)
      }
      const value = callback(key)
      this.set(key, value)
      return value
    },
    writable: true,
    configurable: true,
  })
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

