import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vReveal } from './directives/reveal'
import { useToastStore } from './stores/toast'
import { useAuthStore } from './stores/auth.store'
import { xinPhienTuTabKhac } from './utils/phienGiuaTab'
import './assets/style.css'
import './composables/useTheme' // áp dụng chế độ sáng/tối đã lưu NGAY khi nạp, trước app.mount() để tránh nháy màu (F-UI-05)

const app = createApp(App)
app.use(createPinia())
app.directive('reveal', vReveal)

// Trước đây một lỗi runtime chưa bắt trong bất kỳ component nào (map, socket callback...)
// chỉ log console rồi thôi — người dùng thấy màn hình đứng im, không biết vì sao, không có
// gì để báo lại. Giờ ít nhất báo rõ bằng toast + log đủ thông tin (component, lifecycle hook)
// để debug sau này, thay vì im lặng hoàn toàn.
function baoLoiKhongBat(loi: unknown, boiCanh: string): void {
  console.error(`[Lỗi chưa bắt — ${boiCanh}]`, loi)
  try {
    useToastStore().showToast('Đã xảy ra lỗi không mong muốn. Vui lòng tải lại trang nếu ứng dụng không phản hồi.')
  } catch {
    // Pinia có thể chưa sẵn sàng ở giai đoạn cực sớm của bootstrap — đã log console ở trên rồi.
  }
}

app.config.errorHandler = (err, _instance, info) => baoLoiKhongBat(err, `component: ${info}`)
window.addEventListener('unhandledrejection', (e) => baoLoiKhongBat(e.reason, 'promise rejection'))

// Router chạy guard ngay khi app.use(router) — nên PHẢI có phiên trước bước đó, không thì tab mới
// bị đẩy về trang chủ "chưa đăng nhập" dù tab khác đang đăng nhập (CLAUDE.md Mục 15.30).
async function khoiDong(): Promise<void> {
  const auth = useAuthStore()
  // authStore đã tự khôi phục từ sessionStorage của CHÍNH tab này (F5). Chưa có → hỏi tab khác
  // (chờ tối đa 300 ms, chỉ khi chưa đăng nhập nên tab đã đăng nhập không bị chậm).
  if (!auth.isLoggedIn) {
    const phien = await xinPhienTuTabKhac()
    if (phien) auth.nhanPhien(phien)
  }

  // Gọi fetchMe() chỉ để xác thực lại token còn sống hay không; nếu hết hạn, interceptor 401 trong
  // services/http.ts tự đăng xuất sạch, không cần chặn app.mount() để chờ kết quả này.
  auth.fetchMe().catch(() => {
    // Lỗi đã được http.ts interceptor xử lý (toast + logout nếu 401) — không cần làm gì thêm.
  })

  app.use(router)
  app.mount('#app')
}

void khoiDong()