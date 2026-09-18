/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LETSUR_API_BASE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
