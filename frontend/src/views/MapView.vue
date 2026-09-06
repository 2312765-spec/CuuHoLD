<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { isAxiosError } from 'axios'
import 'leaflet/dist/leaflet.css'
import '@/assets/map-style.css'
import { useLeafletMap } from '@/composables/useLeafletMap'
import { useSocket } from '@/composables/useSocket'
import { useMapDataStore } from '@/stores/mapData'
import { useToastStore } from '@/stores/toast'
import { useOfflineQueueStore } from '@/stores/offlineQueue'
import { CONFIG } from '@/config'
import type { MapLayerKey } from '@/types'
import MapTopBar from '@/components/map/MapTopBar.vue'
import MapStats from '@/components/map/MapStats.vue'
import MapLegend from '@/components/map/MapLegend.vue'
import SosButton from '@/components/sos/SosButton.vue'
import SosConfirmDialog from '@/components/sos/SosConfirmDialog.vue'
import SosTrackerPanel from '@/components/sos/SosTrackerPanel.vue'
import AuthModal from '@/components/AuthModal.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useSos } from '@/composables/useSos'
import { SOS_STATUS_LABEL } from '@/constants/sosLabels'
import type { SosType } from '@/types'
import type { SosUpdatedPayload } from '@/shared/socket-events.types'

const authStore = useAuthStore()
// Nút SOS chỉ dành cho người dân (victim). Rescuer/commander không gửi SOS.
const laVictim = computed(() => authStore.role === 'victim')

// ---------- Modal đăng nhập/đăng ký (chồng lên map) ----------
const isAuthOpen = ref(false)

// ---------- Theo dõi + huỷ SOS vừa gửi (CLAUDE.md Mục 10 — 3 phút huỷ miễn phạt) ----------
// Đếm ngược + nhãn hiển thị đã chuyển vào SosTrackerPanel.vue (thuần trình diễn) — ở đây
// chỉ còn giữ state (useSos) và orchestrate (socket, marker, offline queue).
const sos = useSos()

// ---------- Dialog chọn lý do huỷ ----------
const isCancelDialogOpen = ref(false)
function moCancelDialog() {
  isCancelDialogOpen.value = true
}
async function xacNhanHuySos(reason: 'mistake' | 'resolved_myself' | 'other') {
  isCancelDialogOpen.value = false
  const localId = sos.activeSos.value?.localId
  if (localId) {
    // SOS còn nằm trong hàng đợi offline, chưa từng tới server — không có gì để gọi API
    // huỷ, chỉ cần bỏ khỏi hàng đợi cục bộ là xong.
    await offlineQueueStore.xoaSosKhoiHangDoi(localId)
    sos.dongTheoDoi()
    toastStore.showToast('Đã huỷ yêu cầu đang chờ mạng (chưa từng gửi lên server).')
    return
  }
  try {
    const result = await sos.huyYeuCauSos(reason)
    if (result) {
      toastStore.showToast(
        result.penaltyApplied
          ? 'Đã huỷ yêu cầu — quá hạn 3 phút nên bị tính là huỷ trễ.'
          : 'Đã huỷ yêu cầu, không bị tính phạt.'
      )
    }
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  }
}

// ---------- Luồng gửi SOS thật (nối SosButton → useSos) ----------
const isSosDialogOpen = ref(false)
function moSosDialog() {
  isSosDialogOpen.value = true
}
async function xacNhanGuiSos(payload: { type: SosType; description: string }) {
  isSosDialogOpen.value = false
  // Lấy vị trí hiện tại của người dùng qua trình duyệt; nếu từ chối, dùng tâm bản đồ.
  const viTri = await layViTriHienTai()
  try {
    await sos.guiYeuCauSos({ lat: viTri.lat, lng: viTri.lng, type: payload.type, description: payload.description })
    toastStore.showToast('Đã gửi tín hiệu cứu trợ. Đội điều phối sẽ liên hệ sớm.')
  } catch (err) {
    if (isAxiosError(err) && !err.response) {
      // Mất mạng thật sự (không phải lỗi nghiệp vụ như rate-limit 429/400) — lưu lại để
      // tự gửi ngay khi có mạng, thay vì để yêu cầu cứu trợ biến mất im lặng.
      const localId = crypto.randomUUID()
      sos.datSosChoGui({ localId, lat: viTri.lat, lng: viTri.lng, type: payload.type })
      await offlineQueueStore.themSosVaoHangDoi({
        localId,
        lat: viTri.lat,
        lng: viTri.lng,
        type: payload.type,
        description: payload.description,
        taoLuc: new Date().toISOString()
      })
      toastStore.showToast('Không có mạng — đã lưu yêu cầu, sẽ tự gửi ngay khi có mạng trở lại.')
    }
    // Lỗi nghiệp vụ khác (VD: vượt 5 SOS/giờ) đã có toast riêng từ interceptor http.ts.
  }
}
function layViTriHienTai(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: 11.94, lng: 108.44 })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve({ lat: 11.94, lng: 108.44 }), // từ chối quyền → tâm tỉnh
      { timeout: 5000 }
    )
  })
}

const route = useRoute()
const activeLayer = computed<MapLayerKey>(() => (route.query.layer as MapLayerKey) || 'ranh-gioi')

const mapDataStore = useMapDataStore()
const toastStore = useToastStore()
const offlineQueueStore = useOfflineQueueStore()

const {
  mapInstance,
  boundaryError,
  initMap,
  applyLayerVisibility,
  themMarkerBaoCao,
  capNhatMarkerSosCuaMinh,
  destroyMap
} = useLeafletMap()

watch(boundaryError, (msg) => {
  if (msg) toastStore.showToast(msg)
})

// Vẽ/xoá marker SOS của chính victim mỗi khi trạng thái theo dõi đổi (gửi mới, cập nhật
// qua socket/polling, huỷ, hoặc đóng thẻ theo dõi). deep:true vì useSos.ts sửa .status
// ngay trên object cũ (không gán lại activeSos.value) nên watch nông sẽ không bắt được.
watch(
  () => sos.activeSos.value,
  (active) => {
    capNhatMarkerSosCuaMinh(
      active && {
        lat: active.lat,
        lng: active.lng,
        status: active.status,
        label: SOS_STATUS_LABEL[active.status]
      }
    )
  },
  { deep: true, immediate: true }
)

// ---------- Socket.IO — cập nhật thời gian thực ----------
// TẠM THỜI (Phase 5.3/5.4 sẽ hoàn thiện): lắng nghe sự kiện SOS thật. Hiện chỉ hiện toast
// thông báo; việc vẽ marker SOS lên bản đồ sẽ nối khi mapData store đã đổi sang sosRequests.
const { isConnected, connect } = useSocket({
  onSosNew: (data) => {
    toastStore.showToast(`Có yêu cầu cứu trợ mới tại khu vực ${data.wardCode}`)
  },
  onSosUpdated: (data: SosUpdatedPayload) => {
    // Đúng SOS mình đang theo dõi → cập nhật thẻ theo dõi thay vì chỉ hiện toast chung chung.
    const laSosCuaMinh = sos.capNhatTuSocket(data)
    if (laSosCuaMinh) {
      toastStore.showToast(`Yêu cầu của bạn chuyển sang trạng thái: ${SOS_STATUS_LABEL[data.status]}`)
    } else {
      toastStore.showToast(`Yêu cầu ${data.sosId.slice(0, 8)} chuyển trạng thái: ${data.status}`)
    }
  }
})

// ---------- Khởi tạo / dọn dẹp bản đồ theo vòng đời component ----------
onMounted(async () => {
  await initMap('map', activeLayer.value)
  // Khôi phục SOS đang hoạt động của victim (nếu có) sau khi F5 xoá sạch activeSos trong RAM
  // (CLAUDE.md Mục 15.4) — chỉ gọi khi đã đăng nhập với vai trò victim, vì endpoint chỉ dành
  // cho role đó. Phải chạy TRƯỚC đoạn áp marker bên dưới để marker vẽ đúng ngay từ đầu.
  if (laVictim.value) {
    await sos.khoiPhucSosDangHoatDong()
    // Server không có SOS active nào — có thể vì SOS vừa gửi lúc mất mạng chưa từng tới
    // server, vẫn đang nằm chờ trong IndexedDB. Không khôi phục lại thì badge "đang chờ
    // mạng" vẫn đúng (đọc từ IndexedDB) nhưng thẻ theo dõi + đếm ngược biến mất im lặng.
    if (!sos.activeSos.value) {
      const dangCho = await offlineQueueStore.laySosDangChoGuiGanNhat()
      if (dangCho) {
        sos.datSosChoGui({
          localId: dangCho.localId,
          lat: dangCho.lat,
          lng: dangCho.lng,
          type: dangCho.type,
          taoLuc: dangCho.taoLuc
        })
      }
    }
  }
  // initMap() chạy async (chờ tải ranh giới) — nếu victim gửi SOS ngay lúc đó, watch ở trên
  // đã bỏ qua vì mapInstance chưa sẵn sàng. Áp lại một lần nữa cho chắc sau khi map đã có.
  const active = sos.activeSos.value
  capNhatMarkerSosCuaMinh(
    active && {
      lat: active.lat,
      lng: active.lng,
      status: active.status,
      label: SOS_STATUS_LABEL[active.status]
    }
  )
  mapDataStore.taiDiemCuuTroTuServer()
  connect(CONFIG.socketUrl)
  // Khi có mạng trở lại: báo cáo minh hoạ trong hàng đợi được "gửi" theo đúng luồng
  // themMarkerBaoCao() có sẵn (tái dùng, không viết logic vẽ marker riêng lần 2); SOS thật
  // trong hàng đợi được gửi qua guiSos() thật, kết quả đổ ngược lại thẻ theo dõi hiện tại.
  offlineQueueStore.khoiTao(
    (baoCao) => themMarkerBaoCao(baoCao, activeLayer.value),
    (ketQua, goc) => sos.ghiNhanKetQuaThatTuHangDoi(ketQua, goc.lat, goc.lng)
  )
})
onUnmounted(() => destroyMap())

// Đổi tab lớp (?layer=...) không cần tải lại trang — chỉ cập nhật marker đang hiện.
watch(activeLayer, (layer) => {
  if (mapInstance.value) applyLayerVisibility(mapInstance.value, layer)
})
</script>

<template>
  <div class="map-page">
    <MapTopBar @open-auth="isAuthOpen = true" />
    <MapStats />
    <div id="map"></div>
    <MapLegend />
    <!-- Nút SOS nổi — chỉ hiện cho người dân (victim). Ẩn khi có SOS chưa kết thúc HOẶC
         đang chờ response gửi (dangGui) — thiếu vế sau từng là race condition thật: dialog
         đóng ngay lúc bấm "Gửi ngay" nhưng dangHoatDong chỉ true SAU khi API trả về, nên
         trong lúc mạng chậm nút SOS hiện lại được và bấm gửi trùng lần 2. -->
    <div v-if="laVictim && !sos.dangHoatDong.value && !sos.dangGui.value" class="sos-fab">
      <SosButton @open="moSosDialog" />
    </div>
    <SosConfirmDialog
      :is-open="isSosDialogOpen"
      @cancel="isSosDialogOpen = false"
      @confirm="xacNhanGuiSos"
    />

    <!-- Thẻ theo dõi SOS vừa gửi — xem trạng thái + huỷ trong 3 phút không bị tính phạt -->
    <SosTrackerPanel
      v-if="sos.activeSos.value"
      :active-sos="sos.activeSos.value"
      :dang-hoat-dong="sos.dangHoatDong.value"
      :dang-huy="sos.dangHuy.value"
      @huy="moCancelDialog"
      @dong="sos.dongTheoDoi"
    />

    <!-- Dialog chọn lý do huỷ -->
    <div class="modal-overlay" :class="{ open: isCancelDialogOpen }" @click.self="isCancelDialogOpen = false">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Vì sao bạn muốn huỷ?</h3>
          <button class="modal-close" @click="isCancelDialogOpen = false">✕</button>
        </div>
        <div class="modal-actions" style="flex-direction: column; align-items: stretch;">
          <button class="btn btn-ghost" @click="xacNhanHuySos('mistake')">Gửi nhầm</button>
          <button class="btn btn-ghost" @click="xacNhanHuySos('resolved_myself')">Đã tự xử lý được</button>
          <button class="btn btn-ghost" @click="xacNhanHuySos('other')">Lý do khác</button>
        </div>
      </div>
    </div>
    <div class="socket-status" :class="{ connected: isConnected }">
      <span class="dot"></span>{{ isConnected ? 'Cập nhật thời gian thực: đang bật' : 'Cập nhật thời gian thực: chưa kết nối' }}
    </div>
    <div v-if="offlineQueueStore.soLuongChoGui > 0" class="offline-badge">
      <span class="dot"></span>{{ offlineQueueStore.soLuongChoGui }} báo cáo đang chờ gửi
    </div>
    <div v-if="offlineQueueStore.soLuongSosChoGui > 0" class="offline-badge offline-badge--sos">
      <span class="dot"></span>{{ offlineQueueStore.soLuongSosChoGui }} yêu cầu SOS đang chờ mạng
    </div>
    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
    <AuthModal :is-open="isAuthOpen" @close="isAuthOpen = false" @logged-in="isAuthOpen = false" />
  </div>
</template>