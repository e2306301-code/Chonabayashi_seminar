import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { registerServiceWorker } from './pwa/register'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

void registerServiceWorker(window.navigator, import.meta.env.BASE_URL).catch(
  (error) => console.error('Service worker registration failed', error),
)
