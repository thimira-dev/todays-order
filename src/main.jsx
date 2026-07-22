import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Dismiss the boot splash once React has mounted
const splash = document.getElementById('boot-splash')
if (splash) {
  splash.classList.add('hiding')
  splash.addEventListener('transitionend', () => splash.remove(), { once: true })
  setTimeout(() => splash.remove(), 500)
}
