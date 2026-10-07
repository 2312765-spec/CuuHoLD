// Service quản lý người dùng — chỉ role commander gọi được (RolesGuard backend chặn sẵn).
// Backend trả { success, data, message } — unwrap .data.data. Response dùng entity gốc
// (camelCase) — KHÁC quy ước snake_case của SOS/GIS (những endpoint đó wrap raw SQL).

import { http } from './http'
import { CONFIG } from '@/config'
import type { User } from '@/types/auth'
import type { UserRole } from '@/shared/socket-events.types'

export interface CreateUserPayload {
  phone: string
  name: string
  password: string
  role: UserRole
  wardCode?: string
}

// GET /api/users — role rỗng/undefined thì lấy tất cả.
export async function layDanhSachNguoiDung(role?: UserRole): Promise<User[]> {
  const { data } = await http.get(CONFIG.endpoints.users, {
    params: role ? { role } : undefined
  })
  return data.data as User[]
}

// POST /api/users — tạo tài khoản với role tự chọn (khác /api/auth/register công khai,
// luôn ép victim). Chỉ commander gọi được.
export async function taoNguoiDung(payload: CreateUserPayload): Promise<User> {
  const { data } = await http.post(CONFIG.endpoints.users, payload)
  return data.data as User
}

// PATCH /api/users/:id/role — backend tự chặn 400 nếu id trùng chính commander đang gọi.
export async function doiVaiTro(id: string, role: UserRole): Promise<User> {
  const { data } = await http.patch(`${CONFIG.endpoints.users}/${id}/role`, { role })
  return data.data as User
}

// PATCH /api/users/:id/status — khoá (isActive=false) / mở khoá (isActive=true).
export async function doiTrangThaiKhoa(id: string, isActive: boolean): Promise<User> {
  const { data } = await http.patch(`${CONFIG.endpoints.users}/${id}/status`, { isActive })
  return data.data as User
}
