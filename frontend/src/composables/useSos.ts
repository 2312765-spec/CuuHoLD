// Composable theo dõi + huỷ yêu cầu SOS của victim sau khi gửi (CLAUDE.md Mục 5 — useSos.ts).
// Trước đây MapView gọi thẳng guiSos() rồi quên luôn kết quả — victim không có cách nào xem
// trạng thái hay huỷ SOS vừa gửi (CLAUDE.md Mục 10: "Victim có 3 phút hủy miễn phạt").
// State chỉ tồn tại trong phiên hiện tại — không dùng localStorage (xem .cursorrules), giống
// auth.store mất khi tải lại trang.

import { ref, computed, onUnmounted } from 'vue'
import { guiSos as apiGuiSos, huySos as apiHuySos, xemChiTietSos } from '@/services/sosService'
import type { CreateSosResult, CancelSosResult, SosStatus, SosType } from '@/types'
import type { SosUpdatedPayload } from '@/shared/socket-events.types'

const TERMINAL_STATUSES: readonly SosStatus[] = ['resolved', 'cancelled', 'false_alarm']

export interface ActiveSos {
  id: string
  type: SosType
  status: SosStatus
  lat: number
  lng: number
  createdAt: string
  cancelDeadline: string
  // Có giá trị CHỈ khi SOS này đang nằm trong hàng đợi offline, chưa từng tới server
  // (id lúc này là id tạm trên máy, không tra cứu/huỷ qua API được — xem MapView.vue).
  localId?: string
}

export function useSos() {
  const activeSos = ref<ActiveSos | null>(null)
  const dangGui = ref(false)
  const dangHuy = ref(false)

  // true khi đang có SOS chưa kết thúc — dùng để ẩn nút gửi SOS mới, tránh gửi chồng.
  const dangHoatDong = computed(
    () => activeSos.value !== null && !TERMINAL_STATUSES.includes(activeSos.value.status)
  )

  let pollId: ReturnType<typeof setInterval> | null = null

  function dungTheoDoi(): void {
    if (pollId !== null) {
      clearInterval(pollId)
      pollId = null
    }
  }

  // Dự phòng khi socket không tới (VD: tài khoản tự đăng ký không có ward_code nên
  // không ở trong room ward:* để nhận 'sos:updated') — hỏi lại trạng thái mỗi 20 giây.
  function batDauTheoDoi(id: string): void {
    dungTheoDoi()
    pollId = setInterval(() => {
      xemChiTietSos(id)
        .then((detail) => {
          if (activeSos.value?.id !== id) return
          activeSos.value.status = detail.status
          if (TERMINAL_STATUSES.includes(detail.status)) dungTheoDoi()
        })
        .catch(() => {
          // Lỗi mạng tạm thời — vòng lặp sau tự thử lại, không cần xử lý ở đây.
        })
    }, 20000)
  }

  async function guiYeuCauSos(payload: {
    lat: number
    lng: number
    type: SosType
    description?: string
  }): Promise<CreateSosResult> {
    dangGui.value = true
    try {
      const res = await apiGuiSos(payload)
      activeSos.value = {
        id: res.id,
        type: res.type,
        status: res.status,
        // Backend không trả lại lat/lng trong CreateSosResult — lấy từ đúng toạ độ vừa gửi
        // (server lưu y hệt, chỉ suy thêm ward_code từ đó qua trigger PostGIS).
        lat: payload.lat,
        lng: payload.lng,
        createdAt: res.created_at,
        cancelDeadline: res.cancel_deadline
      }
      batDauTheoDoi(res.id)
      return res
    } finally {
      dangGui.value = false
    }
  }

  // Gọi ngay khi guiSos() thất bại vì MẤT MẠNG (không phải lỗi nghiệp vụ) và MapView đã
  // lưu SOS vào hàng đợi IndexedDB — hiện ngay thẻ theo dõi + marker ở trạng thái "đang
  // chờ mạng" thay vì để màn hình trống như thể chưa gửi gì (dù thực ra đã lưu lại).
  function datSosChoGui(local: { localId: string; lat: number; lng: number; type: SosType }): void {
    activeSos.value = {
      id: local.localId,
      type: local.type,
      status: 'pending',
      lat: local.lat,
      lng: local.lng,
      createdAt: new Date().toISOString(),
      // Hạn huỷ miễn phạt tính tạm từ lúc lưu — sẽ được thay bằng giá trị thật của server
      // ngay khi hàng đợi gửi thành công (ghiNhanKetQuaThatTuHangDoi).
      cancelDeadline: new Date(Date.now() + 3 * 60000).toISOString(),
      localId: local.localId
    }
  }

  // Gọi khi offlineQueueStore gửi lại thành công một SOS đã lưu — thay thẻ "đang chờ mạng"
  // bằng dữ liệu THẬT từ server (id thật, cancel_deadline thật) và bắt đầu theo dõi bình
  // thường. Không cần activeSos đã tồn tại từ trước: nếu victim tải lại trang trong lúc
  // SOS còn nằm chờ, khi gửi thành công vẫn hiện lại đúng thẻ theo dõi.
  function ghiNhanKetQuaThatTuHangDoi(res: CreateSosResult, lat: number, lng: number): void {
    activeSos.value = {
      id: res.id,
      type: res.type,
      status: res.status,
      lat,
      lng,
      createdAt: res.created_at,
      cancelDeadline: res.cancel_deadline
    }
    batDauTheoDoi(res.id)
  }

  async function huyYeuCauSos(
    reason: 'mistake' | 'resolved_myself' | 'other'
  ): Promise<CancelSosResult | null> {
    if (!activeSos.value) return null
    dangHuy.value = true
    try {
      const result = await apiHuySos(activeSos.value.id, reason)
      activeSos.value.status = result.status
      dungTheoDoi()
      return result
    } finally {
      dangHuy.value = false
    }
  }

  // Gọi từ handler 'sos:updated' của useSocket — chỉ áp dụng nếu đúng SOS đang theo dõi.
  // Trả về true nếu đã xử lý (để caller biết khỏi phải hiện toast chung nữa).
  function capNhatTuSocket(data: SosUpdatedPayload): boolean {
    if (!activeSos.value || activeSos.value.id !== data.sosId) return false
    activeSos.value.status = data.status
    if (TERMINAL_STATUSES.includes(data.status)) dungTheoDoi()
    return true
  }

  // Đóng thẻ theo dõi sau khi đã xem kết quả cuối (resolved/cancelled/false_alarm).
  function dongTheoDoi(): void {
    dungTheoDoi()
    activeSos.value = null
  }

  onUnmounted(() => dungTheoDoi())

  return {
    activeSos,
    dangGui,
    dangHuy,
    dangHoatDong,
    guiYeuCauSos,
    datSosChoGui,
    ghiNhanKetQuaThatTuHangDoi,
    huyYeuCauSos,
    capNhatTuSocket,
    dongTheoDoi
  }
}
