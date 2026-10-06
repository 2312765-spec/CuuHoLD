// Service hệ thống — chỉ commander gọi được (RolesGuard backend chặn sẵn). Backend trả
// { success, data, message } — unwrap .data.data. Response snake_case (wrap raw SQL).

import { http } from './http'
import { CONFIG } from '@/config'
import type { SystemStatus, ActivityLogEntry } from '@/types'

// GET /api/system/status — chỉ báo "đã cấu hình" cho ORS/eSMS, KHÔNG bao giờ có giá trị key.
export async function layTrangThaiHeThong(): Promise<SystemStatus> {
  const { data } = await http.get(`${CONFIG.endpoints.system}/status`)
  return data.data as SystemStatus
}

// GET /api/system/activity — nhật ký gộp từ sos_timeline + road_hazards, mới nhất trước.
export async function layNhatKyHoatDong(limit = 50): Promise<ActivityLogEntry[]> {
  const { data } = await http.get(`${CONFIG.endpoints.system}/activity`, { params: { limit } })
  return data.data as ActivityLogEntry[]
}
