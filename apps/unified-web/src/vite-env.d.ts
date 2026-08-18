/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GATEWAY_URL?: string;
  readonly VITE_SCOW_BASE_PATH?: string;
  readonly VITE_USE_MOCK?: string;
}
