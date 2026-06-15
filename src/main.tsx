import { config } from 'zod';
// Zod v4's JIT compiler uses new Function() which violates strict-CSP. Disable
// it so the CSP can remain without 'unsafe-eval'.
config({ jitless: true });

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
