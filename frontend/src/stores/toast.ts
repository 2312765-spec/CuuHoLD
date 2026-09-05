// Pinia store cho toast — trước đây state toast (message/visible) chỉ sống trong
// MapView.vue, trang khác không gọi được. Giờ bất kỳ trang nào cũng showToast() được,
// ví dụ sau này HomeView.vue muốn báo "Đã gửi góp ý thành công" cũng dùng store này.

import { defineStore } from 'pinia'
import { ref } from 'vue'

interface ToastCho {
  msg: string
  durationMs: number
}

export const useToastStore = defineStore('toast', () => {
  const message = ref('')
  const visible = ref(false)

  // Trước đây mỗi showToast() GHI ĐÈ message cũ ngay lập tức — dồn dập nhiều sự kiện (VD:
  // 3 SOS mới báo về cùng lúc ở DashboardView) thì chỉ toast cuối cùng còn hiển thị, các
  // cái trước mất trắng dù người xem chưa kịp đọc. Giờ xếp hàng đợi, hiện lần lượt từng
  // cái, không mất thông tin — chỉ chậm hơn nếu dồn quá nhiều (chấp nhận được, vì đây là
  // toast, không phải log cần xem ngay).
  const hangDoi: ToastCho[] = []
  let dangChay = false

  function chayToastTiepTheo() {
    const tiep = hangDoi.shift()
    if (!tiep) {
      dangChay = false
      return
    }
    dangChay = true
    message.value = tiep.msg
    visible.value = true
    setTimeout(() => {
      visible.value = false
      // Chờ hết hiệu ứng ẩn (CSS .toast transition ~250ms) rồi mới hiện cái kế tiếp, tránh
      // 2 thông báo chồng animation lên nhau nhìn giật.
      setTimeout(chayToastTiepTheo, 300)
    }, tiep.durationMs)
  }

  function showToast(msg: string, durationMs = 3200) {
    hangDoi.push({ msg, durationMs })
    if (!dangChay) chayToastTiepTheo()
  }

  return { message, visible, showToast }
})
