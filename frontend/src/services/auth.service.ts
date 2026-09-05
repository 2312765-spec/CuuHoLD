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
  role?: 'victim' | 'rescuer' | 'commander'
}): Promise<AuthData> {
  const { data } = await http.post(CONFIG.endpoints.auth + '/register', payload)
  return data.data as AuthData
}

export async function getMe(): Promise<User> {
  const { data } = await http.get(CONFIG.endpoints.auth + '/me')
  return data.data as User
}