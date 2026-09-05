// Cấu hình chung cho tầng trình diễn. Địa chỉ backend lấy từ biến môi trường (.env),
// có giá trị mặc định để chạy local khi thiếu .env.

export interface AppConfig {
  apiBaseUrl: string
  socketUrl: string
  endpoints: {
    auth: string
    sos: string
    gisNearestTeams: string
    gisSosHeatmap: string
    rescueTeams: string
  }
}

export const CONFIG: AppConfig = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  socketUrl: import.meta.env.VITE_SOCKET_URL || '/',
  endpoints: {
    auth: '/auth',
    sos: '/sos',
    gisNearestTeams: '/gis/nearest-teams',
    gisSosHeatmap: '/gis/sos-heatmap',
    rescueTeams: '/rescue-teams'
  }
}