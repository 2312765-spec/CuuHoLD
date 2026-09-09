// Nhãn + đích đến của nút CTA chính ở trang chủ, đổi theo role đang đăng nhập.
//
// Dùng chung cho CTA ở AppHeader.vue và CTA ở hero HomeView.vue — 1 nguồn sự thật duy
// nhất. Trước đây 2 chỗ đó cùng hardcode "Xem bản đồ cứu trợ" trỏ tới #ban-do (một khối
// SVG minh hoạ ngay trong trang chủ, KHÔNG phải bản đồ thật ở /map), nên trang chủ thực
// tế chưa từng có đường dẫn nào sang bản đồ. Tách ra đây để thêm role hay đổi đích chỉ
// phải sửa một chỗ, không sợ 2 nút lệch nhau.
//
// dich = null nghĩa là CHƯA đăng nhập: nút không điều hướng đi đâu cả mà mở modal đăng
// nhập tại chỗ (trang chủ là cổng vào — mọi hành động đều cần đăng nhập trước). Người chỉ
// muốn XEM bản đồ vẫn đi được qua link phụ công khai trong hero, không bị chặn.

import { computed, type ComputedRef } from 'vue'
import type { RouteLocationRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'

export interface CtaTheoRole {
  nhan: string
  dich: RouteLocationRaw | null
}

export function useCtaTheoRole(): { cta: ComputedRef<CtaTheoRole> } {
  const authStore = useAuthStore()

  const cta = computed<CtaTheoRole>(() => {
    switch (authStore.role) {
      case 'victim':
        return { nhan: 'Xem bản đồ cứu trợ', dich: { name: 'map' } }
      case 'rescuer':
        return { nhan: 'Nhiệm vụ của tôi', dich: { name: 'rescuer' } }
      case 'commander':
        return { nhan: 'Bảng điều phối', dich: { name: 'dashboard' } }
      default:
        return { nhan: 'Đăng nhập để gửi cứu trợ', dich: null }
    }
  })

  return { cta }
}
