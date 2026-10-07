// Kiểu dữ liệu dùng chung. Enum re-export từ shared (không định nghĩa lại).
// LƯU Ý field naming: response REST của backend nhiều chỗ snake_case (api-contract Mục 2),
// nên type khớp response REST giữ snake_case; payload socket là camelCase (ở shared).

export type {
  SosType,
  SosStatus,
  UserRole,
  RescueTeamStatus,
  HazardType
} from '@/shared/socket-events.types'

import type {
  SosType,
  SosStatus,
  RescueTeamStatus,
  HazardType
} from '@/shared/socket-events.types'

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
  // true nếu toạ độ chỉ là ước tính (GPS thất bại/bị từ chối quyền) — không phải vị trí
  // thật, rescuer/commander cần biết để không hoàn toàn tin vào ghim trên bản đồ.
  location_estimated: boolean
  created_at: string
  updated_at: string
  resolved_at: string | null
  lat: number
  lng: number
  assigned_team_id: string | null
  team_name?: string | null
  // Vị trí hiện tại của đội được giao (null nếu chưa giao đội / đội chưa gửi GPS lần nào).
  team_lat?: number | null
  team_lng?: number | null
  victim_name?: string
  victim_phone?: string
  // Lịch sử các mốc xử lý — backend trả kèm khi GET /sos/:id.
  timeline?: SosTimelineRow[]
}

// Một dòng lịch sử xử lý SOS — khớp SosTimelineRow của backend.
export interface SosTimelineRow {
  id: string
  actor_id: string
  action: string
  note: string | null
  created_at: string
}

// ---- Kết quả POST /api/sos (snake_case) ----
export interface CreateSosResult {
  id: string
  type: SosType
  status: SosStatus
  ward_code: string | null
  created_at: string
  cancel_deadline: string
  location_estimated: boolean
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
  location_estimated: boolean
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
  // Không có trong response REST — chỉ gán từ socket team:location-updated khi đội có SOS active.
  distanceToVictim?: number
  estimatedArrival?: number
}

// ---- Thống kê SOS theo xã: khớp response GET /api/gis/sos-heatmap (snake_case) ----
export interface SosHeatmapPoint {
  lat: number
  lng: number
  ward_code: string
  ward_name: string
  incident_count: number
}

// ---- Thống kê tổng quan: khớp response GET /api/gis/stats (snake_case) ----
export interface CountByKey {
  key: string
  count: number
}
export interface StatsResult {
  total_sos: number
  sos_by_status: CountByKey[]
  sos_by_type: CountByKey[]
  avg_response_minutes: number | null
  teams_by_status: CountByKey[]
  flagged_users_count: number
}

// ---- Hệ thống: khớp GET /api/system/status và /api/system/activity (snake_case) ----
export interface SystemStatus {
  node_env: string
  uptime_seconds: number
  database: { ok: boolean; latency_ms: number | null }
  integrations: {
    ors_configured: boolean
    esms_configured: boolean
    esms_brandname_configured: boolean
  }
  counts: {
    users_by_role: CountByKey[]
    flagged_users: number
    inactive_users: number
    rescue_teams: number
    active_hazards: number
  }
}

export interface ActivityLogEntry {
  at: string
  kind: 'sos' | 'hazard'
  action: string
  actor_name: string | null
  detail: string | null
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

// ---- Cảnh báo/chặn đường: khớp response GET/POST/PATCH /api/hazards (snake_case) ----
// 'blocked' = ĐỎ: chặn đường, thuật toán tìm đường né. 'caution' = VÀNG: cẩn trọng, chỉ hiển thị.
export type HazardSeverity = 'blocked' | 'caution'

export interface Hazard {
  id: string
  type: HazardType
  description: string | null
  lat: number
  lng: number
  radius_meters: number
  severity: HazardSeverity
  ward_code: string | null
  is_active: boolean
  created_at: string
  resolved_at: string | null
}

export interface CreateHazardPayload {
  type: HazardType
  description?: string
  lat: number
  lng: number
  radiusMeters?: number
  severity?: HazardSeverity
}

// ---- Báo cáo cộng đồng: khớp /api/hazard-reports (snake_case) ----
export type ReportStatus = 'pending' | 'approved' | 'rejected'

export interface HazardReport {
  id: string
  type: HazardType
  description: string | null
  lat: number
  lng: number
  accuracy_m: number | null
  location_estimated: boolean
  has_image: boolean
  status: ReportStatus
  ward_code: string | null
  created_at: string
  reviewed_at: string | null
  review_note: string | null
  hazard_id: string | null
  // Khác null = báo cáo này đã được GỘP vào báo cáo chính (cùng loại, cùng điểm trong 100 m).
  duplicate_of: string | null
}

// Cảnh báo đang hoạt động đã phủ khu vực của báo cáo.
export interface NearbyHazard {
  id: string
  type: HazardType
  severity: HazardSeverity
  distance_m: number
}

// Kết quả POST /api/hazard-reports: cho người báo biết báo cáo có được gộp không.
export interface CreateReportResult extends HazardReport {
  merged: boolean
  // Số người (khác nhau) đã báo điểm này, tính cả người vừa gửi.
  group_reporter_count: number
  nearby_hazard: NearbyHazard | null
}

// Một báo cáo đã gộp vào báo cáo chính — commander xem ảnh/mô tả của từng người.
export interface ReportFollower {
  id: string
  reporter_id: string
  reporter_name: string
  reporter_phone: string
  description: string | null
  accuracy_m: number | null
  has_image: boolean
  created_at: string
}

// Bản dành cho commander kiểm duyệt (hàng đợi + lịch sử): có thêm người báo, người duyệt, các
// báo cáo đã gộp.
export interface HazardReportAdmin extends HazardReport {
  reporter_id: string
  reporter_name: string
  reporter_phone: string
  reviewed_by_name: string | null
  // Chỉ có khi đã duyệt: mức độ + trạng thái hiện tại của cảnh báo sinh ra từ báo cáo này.
  hazard_severity: HazardSeverity | null
  hazard_is_active: boolean | null
  duplicate_count: number
  // Số người khác nhau đã báo điểm này (tính cả người báo chính).
  reporter_count: number
  nearby_hazard: NearbyHazard | null
  duplicates: ReportFollower[]
}

// Kết quả PATCH approve/reject — merged_count = số báo cáo trùng xử lý theo cùng.
export interface ReviewOutcome {
  report: HazardReport
  merged_count: number
}

// ---- Kết quả GET /api/routing/route (snake_case, giống các response REST khác) ----
export interface RouteResult {
  distance_meters: number
  duration_seconds: number
  // [lat, lng] — backend đã đảo từ GeoJSON [lng, lat] của OpenRouteService, dùng thẳng cho Leaflet.
  geometry: [number, number][]
  // lat/lng: điểm bắt đầu của bước rẽ — dùng để phát hiện rescuer đã tới gần mà đọc to lên.
  instructions: { text: string; distance_meters: number; lat: number; lng: number }[]
  // Tuyến gợi ý (nhạt hơn trên bản đồ) — cùng có hoặc cùng không với alternate_distance_meters.
  alternate_geometry?: [number, number][]
  alternate_distance_meters?: number
}

// ---- Kết quả PATCH /api/sos/:id/cancel (camelCase) ----
export interface CancelSosResult {
  sosId: string
  status: 'cancelled'
  penaltyApplied: boolean
  // true khi huỷ trễ lần này khiến tài khoản đạt ngưỡng 3 lần → users.is_flagged=true
  // (xem CLAUDE.md Mục 10, Mục 15.1). Không chặn gửi SOS/đăng nhập, chỉ để cảnh báo UI.
  accountFlagged: boolean
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