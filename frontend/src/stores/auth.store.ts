// Pinia store xác thực — lưu accessToken + thông tin user, cung cấp action login/logout.
// LƯU Ý: .cursorrules cấm dùng localStorage. Ở đây token chỉ giữ trong bộ nhớ (mất khi
// tải lại trang) — khi cần "nhớ đăng nhập" sau này, backend nên dùng refreshToken qua
// httpOnly cookie thay vì lưu token trong localStorage (an toàn hơn trước tấn công XSS).

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '@/types/auth'
import { login as apiLogin, getMe as apiGetMe } from '@/services/auth.service'

export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(null)
  const refreshToken = ref<string | null>(null)
  const user = ref<User | null>(null)

  const isLoggedIn = computed(() => !!accessToken.value && !!user.value)
  const role = computed(() => user.value?.role ?? null)

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