// Service cảnh báo/chặn đường (sạt lở, cây đổ, ngập lụt...) — GET xem được với mọi vai trò đã
// đăng nhập, POST/PATCH resolve chỉ commander (RolesGuard backend chặn sẵn).
// Backend trả { success, data, message } — unwrap .data.data. Response snake_case (wrap raw
// SQL, cùng quy ước với SOS/GIS).

import { http } from './http'
import { CONFIG } from '@/config'
import type { Hazard, CreateHazardPayload } from '@/types'

// GET /api/hazards — cảnh báo đang hoạt động, mọi vai trò đã đăng nhập đều gọi được.
export async function layCanhBaoDangHoatDong(): Promise<Hazard[]> {
  const { data } = await http.get(CONFIG.endpoints.hazards)
  return data.data as Hazard[]
}

// GET /api/hazards/all — cả cảnh báo đã gỡ, chỉ commander (dùng cho màn quản lý).
export async function layTatCaCanhBao(): Promise<Hazard[]> {
  const { data } = await http.get(`${CONFIG.endpoints.hazards}/all`)
  return data.data as Hazard[]
}

// POST /api/hazards — tạo cảnh báo mới, chỉ commander.
export async function taoCanhBao(payload: CreateHazardPayload): Promise<Hazard> {
  const { data } = await http.post(CONFIG.endpoints.hazards, payload)
  return data.data as Hazard
}

// PATCH /api/hazards/:id/resolve — gỡ cảnh báo (soft, is_active=false), chỉ commander.
export async function giaiQuyetCanhBao(id: string): Promise<Hazard> {
  const { data } = await http.patch(`${CONFIG.endpoints.hazards}/${id}/resolve`)
  return data.data as Hazard
}
