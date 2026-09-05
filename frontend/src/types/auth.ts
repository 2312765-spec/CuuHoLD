import type { UserRole } from '@/shared/socket-events.types'

// Khớp response /api/auth/login + /register (api-contract Mục 1)
export interface User {
  id: string
  phone: string
  name: string
  role: UserRole
  wardCode: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface AuthData {
  user: User
  accessToken: string
  refreshToken: string
  expiresIn: number
}