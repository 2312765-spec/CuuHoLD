// Service SOS. Backend trả { success, data, message } — unwrap .data.data.
// Field response một số route snake_case, số khác camelCase (api-contract Mục 2) — mỗi
// hàm trả đúng shape route đó, không ép chung 1 interface.

import { http } from './http'
import { CONFIG } from '@/config'
import type {
  SosRequest,
  SosListItem,
  SosType,
  CreateSosResult,
  CancelSosResult,
  AssignSosResult,
  UpdateSosStatusResult
} from '@/types'

// POST /api/sos (role victim). KHÔNG gửi wardCode — backend tự suy từ lat/lng.
export async function guiSos(payload: {
  lat: number
  lng: number
  type: SosType
  description?: string
  imageUrl?: string
}): Promise<CreateSosResult> {
  const { data } = await http.post(CONFIG.endpoints.sos, payload)
  return data.data as CreateSosResult
}

// GET /api/sos (role rescuer/commander) — danh sách tối đa 50, mới nhất trước.
export async function layDanhSachSos(status?: string): Promise<SosListItem[]> {
  const { data } = await http.get(CONFIG.endpoints.sos, { params: status ? { status } : {} })
  return data.data as SosListItem[]
}

// GET /api/sos/:id — chi tiết, kèm timeline (service tự kiểm quyền theo role).
export async function xemChiTietSos(id: string): Promise<SosRequest> {
  const { data } = await http.get(`${CONFIG.endpoints.sos}/${id}`)
  return data.data as SosRequest
}

// PATCH /api/sos/:id/cancel (role victim, chủ SOS). Body reason bắt buộc.
export async function huySos(
  id: string,
  reason: 'mistake' | 'resolved_myself' | 'other'
): Promise<CancelSosResult> {
  const { data } = await http.patch(`${CONFIG.endpoints.sos}/${id}/cancel`, { reason })
  return data.data as CancelSosResult
}

// PATCH /api/sos/:id/assign (role commander). Response data camelCase — khác create/findAll.
export async function phanCongDoi(id: string, teamId: string): Promise<AssignSosResult> {
  const { data } = await http.patch(`${CONFIG.endpoints.sos}/${id}/assign`, { teamId })
  return data.data as AssignSosResult
}

// PATCH /api/sos/:id/status (role rescuer, leader đội được assign).
export async function capNhatTienDo(
  id: string,
  status: 'in_progress' | 'arrived' | 'resolved',
  note?: string
): Promise<UpdateSosStatusResult> {
  const { data } = await http.patch(`${CONFIG.endpoints.sos}/${id}/status`, { status, note })
  return data.data as UpdateSosStatusResult
}
