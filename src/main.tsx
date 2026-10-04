import { config } from 'zod';
// Zod v4's JIT compiler uses new Function() which violates strict-CSP. Disable
// it so the CSP can remain without 'unsafe-eval'.
config({ jitless: true });

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
