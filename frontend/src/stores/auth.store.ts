// Pinia store xác thực — lưu accessToken + thông tin user, cung cấp action login/logout.
//
// Lưu phiên qua sessionStorage (không phải localStorage): sống sót qua F5/reload trong
// cùng tab, tự xoá khi đóng tab/trình duyệt. Đây là fix tạm cho bug "reload là bị đăng
// xuất" — hướng đúng chuẩn lâu dài là refreshToken nằm trong cookie httpOnly (JS không
// đụng vào được, an toàn hơn trước XSS) + endpoint POST /api/auth/refresh thật, nhưng
// backend hiện chưa có (xem docs/api-contract.md, CLAUDE.md Mục 15.1) nên chưa làm được.
// Token khôi phục lại được xác thực ngay qua fetchMe() ở main.ts — token hết hạn/không
// hợp lệ sẽ bị interceptor 401 trong services/http.ts tự logout().

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { User } from '@/types/auth'
import { login as apiLogin, getMe as apiGetMe } from '@/services/auth.service'

const STORAGE_KEY = 'rescue-gis-auth'

interface StoredSession {
  accessToken: string
  refreshToken: string
  user: User
}

function docPhienDaLuu(): StoredSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    // Riêng tư/quota bị chặn, hoặc dữ liệu lưu bị hỏng — coi như chưa đăng nhập.
    return null
  }
}

function luuPhien(session: StoredSession | null): void {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // Không có sessionStorage (chế độ riêng tư nghiêm ngặt...) — chấp nhận mất khả năng
    // khôi phục phiên, không phải lỗi chặn đăng nhập.
  }
}

export const useAuthStore = defineStore('auth', () => {
  const saved = docPhienDaLuu()

  const accessToken = ref<string | null>(saved?.accessToken ?? null)
  const refreshToken = ref<string | null>(saved?.refreshToken ?? null)
  const user = ref<User | null>(saved?.user ?? null)

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value)
  const role = computed(() => user.value?.role ?? null)

  // Đồng bộ mọi thay đổi (login/setAuth/logout/fetchMe cập nhật user) xuống sessionStorage.
  watch([accessToken, refreshToken, user], () => {
    if (accessToken.value && refreshToken.value && user.value) {
      luuPhien({ accessToken: accessToken.value, refreshToken: refreshToken.value, user: user.value })
    } else {
      luuPhien(null)
    }
  })

  async function login(phone: string, password: string) {
    const res = await apiLogin(phone, password)
    accessToken.value = res.accessToken
    refreshToken.value = res.refreshToken
    user.value = res.user
    return res.user
  }

  // Gọi khi đã có token nhưng chưa có user (ví dụ khôi phục phiên) để lấy lại thông tin.
  async function fetchMe() {
    if (!accessToken.value) return null
    user.value = await apiGetMe()
    return user.value
  }

  function logout() {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
  }

  // Gán phiên trực tiếp (dùng sau khi register trả token) — tránh $patch tên internal.
  function setAuth(data: { accessToken: string; refreshToken: string; user: User }) {
    accessToken.value = data.accessToken
    refreshToken.value = data.refreshToken
    user.value = data.user
  }

  return { accessToken, refreshToken, user, isLoggedIn, role, login, fetchMe, logout, setAuth }
})