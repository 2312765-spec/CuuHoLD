// Composable theo dõi + huỷ yêu cầu SOS của victim sau khi gửi (CLAUDE.md Mục 5 — useSos.ts).
// Trước đây MapView gọi thẳng guiSos() rồi quên luôn kết quả — victim không có cách nào xem
// trạng thái hay huỷ SOS vừa gửi (CLAUDE.md Mục 10: "Victim có 3 phút hủy miễn phạt").
//
// activeSos vẫn chỉ là ref trong RAM (mất khi F5) — nhưng giờ có khoiPhucSosDangHoatDong()
// gọi GET /api/sos/mine/active để hỏi lại server lúc mount, nên không còn mất dấu SOS thật
// đang tồn tại trong DB nữa (xem CLAUDE.md Mục 15.4 — bug marker biến mất sau reload).

import { ref, computed, onUnmounted } from 'vue'
import {
  guiSos as apiGuiSos,
  huySos as apiHuySos,
  xemChiTietSos,
  xemSosDangHoatDongCuaToi
} from '@/services/sosService'
import type { CreateSosResult, CancelSosResult, SosStatus, SosType } from '@/types'
import type { SosUpdatedPayload } from '@/shared/socket-events.types'

const TERMINAL_STATUSES: readonly SosStatus[] = ['resolved', 'cancelled', 'false_alarm']

export interface ActiveSos {
  id: string
  type: SosType
  status: SosStatus
  lat: number
  lng: number
  // true nếu toạ độ chỉ là ước tính (GPS thất bại/bị từ chối quyền lúc gửi) — dùng hiện
  // cảnh báo cho victim ở SosTrackerPanel (fix P0 an toàn, xem CLAUDE.md Mục 15).
  locationEstimated: boolean
  createdAt: string
  cancelDeadline: string
  // Vị trí đội cứu hộ được giao — lấy từ GET /api/sos/:id (lúc khôi phục + mỗi lượt poll 20s).
  // undefined/null khi chưa giao đội hoặc đội chưa gửi GPS. Không cập nhật qua socket: GPS đội
  // chỉ mới mỗi 30s nên poll 20s sẵn có là đủ (Fix #2, CLAUDE.md Mục 15.11).
  teamLat?: number | null
  teamLng?: number | null
  // Có giá trị CHỈ khi SOS này đang nằm trong hàng đợi offline, chưa từng tới server
  // (id lúc này là id tạm trên máy, không tra cứu/huỷ qua API được — xem MapView.vue).
  localId?: string
  // Id đội cứu hộ được phân công (có khi status = assigned trở đi). Backend chỉ gửi id,
  // không gửi tên/ETA trong payload hiện tại — nên UI chỉ báo "đã có đội", không bịa ETA.
  assignedTeamId?: string
  // true khi đã nhận được ít nhất 1 cập nhật vị trí đội qua team:location-updated —
  // dùng để báo victim "đội đang di chuyển tới" thay vì chỉ "đã phân công".
  teamDangDiChuyen?: boolean
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
          activeSos.value.teamLat = detail.team_lat ?? null
          activeSos.value.teamLng = detail.team_lng ?? null
          // Từng bị bỏ quên ở đây — chỉ gán qua socket 'sos:updated', nên nếu victim bỏ lỡ
          // socket đó (F5 ngay sau lúc giao đội, mất kết nối...), "đã có đội" không bao giờ
          // hiện dù poll này vẫn nhận đủ dữ liệu từ server.
          if (detail.assigned_team_id) activeSos.value.assignedTeamId = detail.assigned_team_id
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
    locationEstimated?: boolean
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
        locationEstimated: res.location_estimated,
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
  //
  // taoLuc optional — CHỈ truyền khi khôi phục lại 1 item đã có sẵn trong IndexedDB từ
  // trước (VD: F5 ngay lúc vẫn mất mạng, xem MapView.vue onMounted). Không truyền = coi
  // như vừa lưu lúc này (đúng hành vi gốc). Nếu không phân biệt 2 trường hợp, mỗi lần
  // component remount sẽ tính lại cancelDeadline = now+3phút, vô tình kéo dài hạn huỷ miễn
  // phạt so với hạn thật tính từ lúc gửi ban đầu.
  function datSosChoGui(local: {
    localId: string
    lat: number
    lng: number
    type: SosType
    locationEstimated: boolean
    taoLuc?: string
  }): void {
    const createdAt = local.taoLuc ?? new Date().toISOString()
    activeSos.value = {
      id: local.localId,
      type: local.type,
      status: 'pending',
      lat: local.lat,
      lng: local.lng,
      locationEstimated: local.locationEstimated,
      createdAt,
      // Hạn huỷ miễn phạt tính tạm từ lúc lưu — sẽ được thay bằng giá trị thật của server
      // ngay khi hàng đợi gửi thành công (ghiNhanKetQuaThatTuHangDoi).
      cancelDeadline: new Date(new Date(createdAt).getTime() + 3 * 60000).toISOString(),
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
      locationEstimated: res.location_estimated,
      createdAt: res.created_at,
      cancelDeadline: res.cancel_deadline
    }
    batDauTheoDoi(res.id)
  }

  // Gọi lúc MapView mount (chỉ khi victim đã đăng nhập) — hỏi lại server xem có SOS nào
  // chưa kết thúc không, để dựng lại đúng marker + thẻ theo dõi sau khi F5. Không gọi nếu
  // đã có activeSos rồi (VD: vừa gửi xong trong cùng phiên) để khỏi ghi đè state mới hơn.
  async function khoiPhucSosDangHoatDong(): Promise<void> {
    if (activeSos.value) return
    try {
      const detail = await xemSosDangHoatDongCuaToi()
      if (!detail) return
      activeSos.value = {
        id: detail.id,
        type: detail.type,
        status: detail.status,
        lat: detail.lat,
        lng: detail.lng,
        locationEstimated: detail.location_estimated,
        createdAt: detail.created_at,
        cancelDeadline: detail.cancel_deadline,
        teamLat: detail.team_lat ?? null,
        teamLng: detail.team_lng ?? null,
        assignedTeamId: detail.assigned_team_id ?? undefined
      }
      batDauTheoDoi(detail.id)
    } catch {
      // "Không có SOS active" trả về data:null bình thường (đã return ở trên, không rơi vào
      // đây) — catch này chỉ bắt lỗi thật (mất mạng/401 token hết hạn), interceptor http.ts
      // đã tự hiện toast/logout nếu cần, im lặng bỏ qua là đủ.
    }
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
    // Lưu id đội được phân công (nếu có) để SosTrackerPanel báo "đã có đội".
    if (data.assignedTeamId) activeSos.value.assignedTeamId = data.assignedTeamId
    if (TERMINAL_STATUSES.includes(data.status)) dungTheoDoi()
    return true
  }

  // Gọi khi nhận team:location-updated — đánh dấu đội đang di chuyển tới victim.
  function danhDauDoiDiChuyen(teamId: string): boolean {
    if (!activeSos.value) return false
    if (activeSos.value.assignedTeamId && activeSos.value.assignedTeamId !== teamId) return false
    activeSos.value.teamDangDiChuyen = true
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
    khoiPhucSosDangHoatDong,
    huyYeuCauSos,
    capNhatTuSocket,
    danhDauDoiDiChuyen,
    dongTheoDoi
  }
}