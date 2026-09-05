import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { vReveal } from './directives/reveal'
import { useToastStore } from './stores/toast'
import './assets/style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)
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

app.mount('#app')