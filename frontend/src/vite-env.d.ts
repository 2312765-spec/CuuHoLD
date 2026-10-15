/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SOCKET_URL?: string
  // Cờ bật tính năng chờ backend — xem src/constants/tinhNangBackend.ts.
  readonly VITE_BAT_SUA_HO_SO?: string
  readonly VITE_BAT_LICH_SU_SOS?: string
  readonly VITE_BAT_THONG_BAO_DAY?: string
}
