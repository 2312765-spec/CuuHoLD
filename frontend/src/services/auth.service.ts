// Service xác thực. Backend trả { success, data, message } — unwrap .data.data.
// Response lỗi KHÔNG có field success (api-contract Mục 0) — xử lý ở interceptor http.ts.

import { http } from './http'
import { CONFIG } from '@/config'
import type { AuthData, User } from '@/types/auth'

export async function login(phone: string, password: string): Promise<AuthData> {
  const { data } = await http.post(CONFIG.endpoints.auth + '/login', { phone, password })
  return data.data as AuthData
}

export async function register(payload: {
  phone: string
  name: string
  password: string
}): Promise<AuthData> {
  const { data } = await http.post(CONFIG.endpoints.auth + '/register', payload)
  return data.data as AuthData
}

export async function getMe(): Promise<User> {
  const { data } = await http.get(CONFIG.endpoints.auth + '/me')
  return data.data as User
}
// F-UI-01 — hồ sơ cá nhân. Route theo đặc tả gửi B (F-UI-01-dac-ta-API-cho-B.md): chỉ sửa
// được TÊN — phone là tên đăng nhập, wardCode quyết định rescuer xem SOS xã nào (cho tự đổi =
// tự mở quyền xem SOS xã khác), nên cả 2 cố ý không gửi.
export async function capNhatHoSo(name: string): Promise<User> {
  const { data } = await http.patch('/users/me', { name })
  return data.data as User
}

// Sai mật khẩu hiện tại: backend trả 400 (KHÔNG 401 — http.ts gặp 401 lúc đang đăng nhập sẽ
// tự đăng xuất). Thông báo lỗi do interceptor http.ts hiện.
export async function doiMatKhau(currentPassword: string, newPassword: string): Promise<void> {
  await http.patch('/users/me/password', { currentPassword, newPassword })
}
