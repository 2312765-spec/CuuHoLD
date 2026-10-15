import axios from 'axios'
import { CONFIG } from '@/config'
import { useToastStore } from '@/stores/toast'
import { useAuthStore } from '@/stores/auth.store'
import { thongBaoLoiThanThien } from './thongBaoLoi'

// Cờ tuỳ chọn cho từng request: bỏ qua toast lỗi toàn cục bên dưới. Dùng cho API "nâng cao"
// đã tự có fallback riêng, không nên báo lỗi mỗi lần thất bại (VD: routingService.ts —
// OpenRouteService thiếu key/lỗi mạng thì lặng lẽ giữ đường chim bay đã vẽ sẵn, không hiện
// "Máy chủ đang gặp sự cố" mỗi 30 giây trong lúc rescuer đang làm nhiệm vụ thật).
declare module 'axios' {
  export interface AxiosRequestConfig {
    khongHienToastLoi?: boolean
  }
}

export const http = axios.create({
  baseURL: CONFIG.apiBaseUrl,
  timeout: 8000,
  headers: { 'Content-Type': 'application/json' }
})

// Request interceptor: gắn Bearer token vào mọi request nếu đã đăng nhập (Phase 2).
http.interceptors.request.use((config) => {
  const token = useAuthStore().accessToken
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.config?.khongHienToastLoi) {
      return Promise.reject(error)
    }

    const toastStore = useToastStore()
    const authStore = useAuthStore()

    if (!axios.isAxiosError(error)) {
      toastStore.showToast('Đã xảy ra lỗi không xác định.')
      return Promise.reject(error)
    }

    if (error.code === 'ECONNABORTED') {
      toastStore.showToast('Kết nối máy chủ quá chậm, vui lòng thử lại.')
    } else if (!error.response) {
      toastStore.showToast('Không thể kết nối máy chủ. Kiểm tra lại mạng.')
    } else if (error.response.status === 401 && authStore.isLoggedIn) {
      // accessToken hết hạn/không hợp lệ GIỮA phiên (không phải sai mật khẩu lúc đăng nhập —
      // lúc đó authStore.isLoggedIn còn false). KHÔNG có /api/auth/refresh (api-contract.md
      // dặn rõ đừng code silent-refresh) nên chỉ còn cách đăng xuất sạch, bắt đăng nhập lại,
      // thay vì để mọi request sau đó âm thầm thất bại vô thời hạn.
      authStore.logout()
      toastStore.showToast('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.')
    } else if (error.response.status >= 500) {
      toastStore.showToast('Máy chủ đang gặp sự cố, vui lòng thử lại sau.')
    } else {
      // 400/401 (sai mật khẩu)/403/404/409 — lỗi nghiệp vụ. Trước đây các nơi gọi API chỉ
      // `catch {}` rỗng, tin nhầm là interceptor này đã hiện toast — thực ra chưa từng có.
      // Câu tiếng Việt dễ hiểu thay cho thông báo kỹ thuật (xem services/thongBaoLoi.ts).
      toastStore.showToast(thongBaoLoiThanThien(error.response.status, error.response.data))
    }

    return Promise.reject(error)
  }
)