import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vReveal } from './directives/reveal'
import { useToastStore } from './stores/toast'
import { useAuthStore } from './stores/auth.store'
import './assets/style.css'
import './composables/useTheme' // áp dụng chế độ sáng/tối đã lưu NGAY khi nạp, trước app.mount() để tránh nháy màu (F-UI-05)

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.directive('reveal', vReveal)

// authStore khôi phục accessToken/user từ sessionStorage ngay lúc khởi tạo (xem
// stores/auth.store.ts) — isLoggedIn đã đúng ngay từ router guard đầu tiên. Gọi fetchMe()
// ở đây chỉ để xác thực lại token còn sống hay không; nếu hết hạn, interceptor 401 trong
// services/http.ts tự đăng xuất sạch, không cần chặn app.mount() để chờ kết quả này.
useAuthStore().fetchMe().catch(() => {
  // Lỗi đã được http.ts interceptor xử lý (toast + logout nếu 401) — không cần làm gì thêm.
})

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

app.mount('#app')