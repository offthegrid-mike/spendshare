// Must stay first: it disables Zod's JIT before any schema is built. See the
// module for why calling config() here instead would be too late.
import './lib/zodConfig'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import './index.css'
import App from './App.tsx'
import { startThemeSync } from './lib/theme'

// Before the first render so the stored theme is in place on first paint.
startThemeSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
