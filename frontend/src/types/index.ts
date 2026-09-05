// Kiểu dữ liệu dùng chung. Enum re-export từ shared (không định nghĩa lại).
// LƯU Ý field naming: response REST của backend nhiều chỗ snake_case (api-contract Mục 2),
// nên type khớp response REST giữ snake_case; payload socket là camelCase (ở shared).

export type { SosType, SosStatus, UserRole, RescueTeamStatus } from '@/shared/socket-events.types'

import type { SosType, SosStatus, RescueTeamStatus } from '@/shared/socket-events.types'

// ---- SOS: khớp response GET /api/sos/:id (snake_case) ----
export interface SosRequest {
  id: string
  victim_id: string
  type: SosType
  status: SosStatus
  description: string | null
  image_url: string | null
  ward_code: string
  cancel_deadline: string
  created_at: string
  updated_at: string
  resolved_at: string | null
  lat: number
  lng: number
  assigned_team_id: string | null
  team_name?: string | null
  victim_name?: string
  victim_phone?: string
}

// ---- Kết quả POST /api/sos (snake_case) ----
export interface CreateSosResult {
  id: string
  type: SosType
  status: SosStatus
  ward_code: string | null
  created_at: string
  cancel_deadline: string
}

// ---- SOS tóm tắt: khớp response GET /api/sos (danh sách) ----
export interface SosListItem {
  id: string
  type: SosType
  status: SosStatus
  ward_code: string
  created_at: string
  lat: number
  lng: number
  victim_name: string
  victim_phone: string
}

// ---- Rescue team: khớp response GET /api/rescue-teams (snake_case, lat/lng có thể null) ----
export interface RescueTeam {
  id: string
  name: string
  status: RescueTeamStatus
  specialties: string[]
  ward_code: string
  lat: number | null
  lng: number | null
  leader_id: string
  leader_name: string
  leader_phone: string
}

// ---- Đội gần nhất: khớp response GET /api/gis/nearest-teams (snake_case) ----
export interface NearestTeam {
  id: string
  name: string
  status: RescueTeamStatus
  specialties: string[]
  lat: number
  lng: number
  distance_meters: number
  eta_minutes: number
  leader_name: string
  leader_phone: string
}

// ---- Kết quả PATCH /api/sos/:id/cancel (camelCase) ----
export interface CancelSosResult {
  sosId: string
  status: 'cancelled'
  penaltyApplied: boolean
}

// ---- Kết quả PATCH /api/sos/:id/assign (camelCase — khác các route SOS khác) ----
export interface AssignSosResult {
  sosId: string
  teamId: string
  status: SosStatus
  wardCode: string
  updatedAt: string
}

// ---- Kết quả PATCH /api/sos/:id/status (camelCase) ----
export interface UpdateSosStatusResult {
  sosId: string
  status: SosStatus
  updatedAt: string
}

// ---- Kết quả PATCH /api/rescue-teams/:id/location (camelCase) ----
export interface UpdateTeamLocationResult {
  teamId: string
  wardCode: string
  lat: number
  lng: number
  updatedAt: string
}

// ---- Type UI thuần frontend (giữ nguyên) ----
export type MapLayerKey = 'ranh-gioi' | 'diem-cuutro' | 'bao-cao'

export interface LayerTab { key: MapLayerKey; label: string }
export interface FeatureCardData { num: string; title: string; desc: string; linkLabel: string; layer: MapLayerKey }
export interface HighlightFeatureData { title: string; desc: string; icon: string }
export interface ProcessStepData { n: number; title: string; desc: string }

// ---- Type cũ (dữ liệu minh hoạ) — GIỮ TẠM tới khi Phase 5A đổi xong mapData/marker ----
export interface DiemCuuTro { ten: string; lat: number; lng: number; loai: string; mau: string }
export interface BaoCaoSuCo { ten: string; lat: number; lng: number; mucDo: string; mau: string }