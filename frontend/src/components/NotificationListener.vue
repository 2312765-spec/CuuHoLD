<script setup lang="ts">
// F-UI-03 — nghe sự kiện real-time và GHI vào lịch sử thông báo, ở MỌI trang (CLAUDE.md 15.x).
// Trước đây phần này nằm trong NotificationBell — mà chuông chỉ có ở header trang chủ, nên SOS
// mới / đã cứu hộ xong / đã huỷ xảy ra lúc đang ở Dashboard, Rescuer hay bản đồ đều KHÔNG được
// ghi lại. Giờ đặt ở App.vue, ngoài <RouterView> (không bị huỷ khi chuyển trang); chuông chỉ
// còn hiển thị. Đổi lại, các trang có socket riêng (Dashboard/Rescuer/Map) sẽ có thêm 1 kết nối.
import { watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'
import { useNotificationStore, thongBaoTheoTrangThai } from '@/stores/notifications'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { SOS_TYPE_LABEL } from '@/constants/sosLabels'
import { HAZARD_TYPE_LABEL } from '@/constants/hazardLabels'
import { useToastStore } from '@/stores/toast'
import type {
  SosNewPayload,
  SosUpdatedPayload,
  SystemNotificationPayload,
  HazardReportNewPayload
} from '@/shared/socket-events.types'

const authStore = useAuthStore()
const { isLoggedIn } = storeToRefs(authStore)
const store = useNotificationStore()
const route = useRoute()
const toastStore = useToastStore()

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
  },
  // Báo cáo sạt lở/chặn đường mới cần duyệt — server chỉ gửi cho commander (phòng province:lamdong).
  // Trước đây chỉ Bảng điều phối nghe sự kiện này: commander đang ở trang khác (Người dùng, Thống
  // kê, Hệ thống, trang chủ...) không hề biết có báo cáo mới.
  onHazardReportNew: (d: HazardReportNewPayload) => {
    const loai = HAZARD_TYPE_LABEL[d.type] ?? d.type
    store.them({
      loai: 'bao-cao-moi',
      icon: '🚧',
      tieuDe: d.mergedIntoReportId
        ? `Thêm người báo trùng · ${loai} (${d.reporterCount} người)`
        : `Báo cáo mới chờ duyệt · ${loai}`,
      moTa: `${d.reporterName} — bấm để mở hàng đợi duyệt`
    })
    // Bảng điều phối tự hiện toast riêng (và làm mới hàng đợi) — không báo trùng ở đó.
    if (route?.name !== 'dashboard') toastStore.showToast(`🚧 Có báo cáo ${loai} mới cần duyệt`)
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
