/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend origin when it is not served from the same host, e.g. https://surya-backend.onrender.com */
  readonly VITE_API_URL?: string;
  /** Google OAuth web client ID; enables "Continue with Google" when set. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
