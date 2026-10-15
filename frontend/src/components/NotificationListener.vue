<script setup lang="ts">
// F-UI-03 — nghe sự kiện real-time và GHI vào lịch sử thông báo, ở MỌI trang (CLAUDE.md 15.x).
// Trước đây phần này nằm trong NotificationBell — mà chuông chỉ có ở header trang chủ, nên SOS
// mới / đã cứu hộ xong / đã huỷ xảy ra lúc đang ở Dashboard, Rescuer hay bản đồ đều KHÔNG được
// ghi lại. Giờ đặt ở App.vue, ngoài <RouterView> (không bị huỷ khi chuyển trang); chuông chỉ
// còn hiển thị. Đổi lại, các trang có socket riêng (Dashboard/Rescuer/Map) sẽ có thêm 1 kết nối.
import { watch, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'
import { useNotificationStore, thongBaoTheoTrangThai } from '@/stores/notifications'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { SOS_TYPE_LABEL } from '@/constants/sosLabels'
import type {
  SosNewPayload,
  SosUpdatedPayload,
  SystemNotificationPayload
} from '@/shared/socket-events.types'

const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const store = useNotificationStore()

const { connect, disconnect } = useSocket({
  onSosNew: (d: SosNewPayload) => {
    store.them({
      loai: 'sos-moi',
      icon: '🆘',
      tieuDe: `Đã ghi nhận SOS mới · ${SOS_TYPE_LABEL[d.type] ?? d.type}`,
      moTa: `${d.victimName ?? 'Nạn nhân'} — xã/phường ${d.wardCode ?? '—'}`,
      sosId: d.sosId
    })
  },
  onSosUpdated: (d: SosUpdatedPayload) => {
    const { tieuDe, icon } = thongBaoTheoTrangThai(d.status)
    store.them({
      loai: 'sos-capnhat',
      icon,
      tieuDe,
      moTa: `Mã yêu cầu ${d.sosId.slice(0, 8)}`,
      sosId: d.sosId
    })
  },
  onSystemNotification: (d: SystemNotificationPayload) => {
    const tieuDe =
      d.level === 'critical' ? 'Cảnh báo khẩn' : d.level === 'warning' ? 'Cảnh báo' : 'Thông báo hệ thống'
    store.them({ loai: 'he-thong', icon: '📢', tieuDe, moTa: d.message })
  }
})

// Nối/ngắt theo trạng thái đăng nhập — đăng nhập giữa chừng hay đăng xuất đều cập nhật đúng.
function dongBoKetNoi() {
  if (isLoggedIn.value) connect(CONFIG.socketUrl)
  else disconnect()
}
onMounted(dongBoKetNoi)
watch(isLoggedIn, dongBoKetNoi)
</script>

<template>
  <span hidden></span>
</template>
