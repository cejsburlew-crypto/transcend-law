import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './App.css'

// Force light mode before rendering
localStorage.removeItem('darkMode')
localStorage.removeItem('theme')
document.documentElement.setAttribute('data-theme', 'light')
document.documentElement.style.colorScheme = 'light'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
