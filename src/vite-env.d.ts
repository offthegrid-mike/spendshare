/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FB_API_KEY: string;
  readonly VITE_FB_AUTH_DOMAIN: string;
  readonly VITE_FB_PROJECT_ID: string;
  readonly VITE_FB_STORAGE_BUCKET: string;
  readonly VITE_FB_SENDER_ID: string;
  readonly VITE_FB_APP_ID: string;
  readonly VITE_USE_EMULATOR?: string;
  // Optional: URL of the receipt-OCR proxy (Cloudflare Worker in worker/).
  // Absent → scanning is disabled at runtime.
  readonly VITE_OCR_PROXY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Injected by vite.config.ts at build time.
declare const __APP_COMMIT__: string | null;
declare const __APP_BUILT_AT__: string;
