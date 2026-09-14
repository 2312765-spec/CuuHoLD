<script setup lang="ts">
// Danh sách nhiệm vụ (rescuer) — SOS đang được phân công cho đội mình phụ trách.
// Theo dõi GPS: khi có SOS active (assigned/in_progress/arrived), watchPosition() giữ
// toạ độ mới nhất, setInterval 30s gửi định kỳ lên PATCH /api/rescue-teams/:id/location
// (CLAUDE.md Mục 8: "Rescuer gửi GPS mỗi 30 giây").
// Bản đồ (SRS 6.1 "route di chuyển trên bản đồ"): đường THẲNG từ vị trí GPS của mình tới
// nạn nhân của nhiệm vụ đang chọn + khoảng cách/ETA ước tính. Dẫn đường theo đường bộ thật
// giao cho Google Maps (link "Chỉ đường") — không gọi dịch vụ định tuyến ngoài nào.

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { layDanhSachSos, xemChiTietSos, capNhatTienDo } from '@/services/sosService'
import { fetchRescueTeams, capNhatViTriDoi } from '@/services/rescueTeamsService'
import { khoangCachMet, etaPhut } from '@/utils/geo'
import RescueMap from '@/components/map/RescueMap.vue'
import type { SosRequest, SosType, SosStatus, RescueTeam } from '@/types'
import type { SosUpdatedPayload } from '@/shared/socket-events.types'

const authStore = useAuthStore()
const toastStore = useToastStore()

const SOS_TYPE_LABEL: Record<SosType, string> = {
  flood: 'Lũ lụt',
  landslide: 'Sạt lở',
  accident: 'Tai nạn',
  medical: 'Y tế',
  fire: 'Hoả hoạn',
  lost: 'Lạc đường',
  drowning: 'Đuối nước',
  agricultural: 'Nông nghiệp',
  adventure: 'Mạo hiểm',
  other: 'Khác'
}

const SOS_STATUS_LABEL: Record<SosStatus, string> = {
  pending: 'Chờ xử lý',
  assigned: 'Đã phân công',
  in_progress: 'Đang thực hiện',
  arrived: 'Đã đến nơi',
  resolved: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  false_alarm: 'Báo giả'
}

const ACTIVE_STATUSES: readonly SosStatus[] = ['assigned', 'in_progress', 'arrived']

interface NextAction {
  label: string
  next: 'in_progress' | 'arrived' | 'resolved'
  note?: string
}

const NEXT_ACTION: Partial<Record<SosStatus, NextAction>> = {
  assigned: { label: 'Bắt đầu di chuyển', next: 'in_progress', note: 'Đang di chuyển' },
  in_progress: { label: 'Đã đến nơi', next: 'arrived' },
  arrived: { label: 'Hoàn thành cứu hộ', next: 'resolved' }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
}

// Link dẫn đường của Google Maps: bỏ trống origin để Google tự lấy vị trí hiện tại của
// máy (chính xác hơn toạ độ app đang giữ, vốn có thể đã cũ vài giây).
function chiDuongLink(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
}

// ---------- Xác định đội mình phụ trách ----------
const myTeamId = ref<string | null>(null)
const loadingTeam = ref(false)

async function taiDoiCuaMinh(): Promise<void> {
  loadingTeam.value = true
  try {
    const teams = await fetchRescueTeams()
    const myTeam = teams.find((t) => t.leader_id === authStore.user?.id)
    myTeamId.value = myTeam?.id ?? null
    if (!myTeamId.value) {
      toastStore.showToast('Tài khoản này chưa được gán làm trưởng đội cứu hộ nào.')
    }
  } finally {
    loadingTeam.value = false
  }
}

// ---------- Danh sách SOS đang được phân công cho đội mình ----------
const sosList = ref<SosRequest[]>([])
const loadingSos = ref(false)
const updatingId = ref<string | null>(null)

async function taiDanhSachNhiemVu(): Promise<void> {
  if (!myTeamId.value) {
    sosList.value = []
    return
  }
  loadingSos.value = true
  try {
    const summaries = await layDanhSachSos(ACTIVE_STATUSES.join(','))
    const details = await Promise.all(summaries.map((s) => xemChiTietSos(s.id)))
    sosList.value = details.filter((d) => d.assigned_team_id === myTeamId.value)
  } finally {
    loadingSos.value = false
  }
}

function boSosKhoiDanhSach(sosId: string): void {
  sosList.value = sosList.value.filter((s) => s.id !== sosId)
}

async function capNhat(sos: SosRequest): Promise<void> {
  const action = NEXT_ACTION[sos.status]
  if (!action) return
  updatingId.value = sos.id
  try {
    const result = await capNhatTienDo(sos.id, action.next, action.note)
    if (result.status === 'resolved') {
      boSosKhoiDanhSach(sos.id)
    } else {
      sos.status = result.status
    }
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: sai transition, không phải leader đội được assign).
  } finally {
    updatingId.value = null
  }
}

// ---------- Socket.IO — cập nhật thời gian thực ----------
const { isConnected, connect } = useSocket({
  onSosUpdated: async (data: SosUpdatedPayload) => {
    if (!myTeamId.value) return

    const existing = sosList.value.find((s) => s.id === data.sosId)
    if (existing) {
      if (!ACTIVE_STATUSES.includes(data.status)) {
        boSosKhoiDanhSach(data.sosId)
      } else {
        existing.status = data.status
      }
      return
    }

    if (data.assignedTeamId === myTeamId.value && ACTIVE_STATUSES.includes(data.status)) {
      try {
        const detail = await xemChiTietSos(data.sosId)
        sosList.value = [detail, ...sosList.value]
        toastStore.showToast(`Nhiệm vụ mới: ${detail.victim_name ?? ''} — ${SOS_TYPE_LABEL[detail.type]}`)
      } catch {
        // Interceptor http.ts đã hiện toast lỗi mạng/server.
      }
    }
  }
})

// ---------- GPS: watchPosition giữ toạ độ mới nhất, gửi lên server mỗi 30 giây ----------
const hasActiveSos = computed(() => sosList.value.some((s) => ACTIVE_STATUSES.includes(s.status)))

let watchId: number | null = null
let sendIntervalId: ReturnType<typeof setInterval> | null = null
const lastPosition = ref<{ lat: number; lng: number } | null>(null)

async function guiViTriLenServer(): Promise<void> {
  if (!myTeamId.value || !lastPosition.value) return
  try {
    await capNhatViTriDoi(myTeamId.value, lastPosition.value.lat, lastPosition.value.lng)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  }
}

function batDauTheoDoiGps(): void {
  if (watchId !== null || !navigator.geolocation) return
  watchId = navigator.geolocation.watchPosition(
    (pos) => {
      lastPosition.value = { lat: pos.coords.latitude, lng: pos.coords.longitude }
    },
    () => {
      toastStore.showToast('Không lấy được vị trí GPS — kiểm tra quyền truy cập vị trí.')
    },
    { enableHighAccuracy: true }
  )
  sendIntervalId = setInterval(guiViTriLenServer, 30000)
}

function dungTheoDoiGps(): void {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId)
    watchId = null
  }
  if (sendIntervalId !== null) {
    clearInterval(sendIntervalId)
    sendIntervalId = null
  }
  lastPosition.value = null
}

watch(
  hasActiveSos,
  (active) => {
    if (active) batDauTheoDoiGps()
    else dungTheoDoiGps()
  },
  { immediate: true }
)

// ---------- Bản đồ: đường từ vị trí mình tới nạn nhân của nhiệm vụ đang chọn ----------
// Đội cứu hộ khác không vẽ — rescuer chỉ cần thấy chính mình và nạn nhân.
const KHONG_VE_DOI: RescueTeam[] = []

const selectedSosId = ref<string | null>(null)
// Chưa chọn (hoặc nhiệm vụ đang chọn vừa kết thúc) → mặc định nhiệm vụ đầu danh sách.
const selectedSos = computed(
  () => sosList.value.find((s) => s.id === selectedSosId.value) ?? sosList.value[0] ?? null
)
const route = computed(() =>
  lastPosition.value && selectedSos.value
    ? { from: lastPosition.value, to: { lat: selectedSos.value.lat, lng: selectedSos.value.lng } }
    : null
)

function chonNhiemVu(id: string): void {
  selectedSosId.value = id
}

function quangDuong(sos: SosRequest): string | null {
  if (!lastPosition.value) return null
  const met = khoangCachMet(lastPosition.value, sos)
  return `≈ ${(met / 1000).toFixed(1)} km đường chim bay · ~${etaPhut(met)} phút (ước tính 40 km/h)`
}

// Tile nền OSM lỗi — marker SOS và đường tới nạn nhân vẫn đúng (vector), chỉ nền raster
// thiếu. RescueMap.vue tự dedupe trước khi emit, giống DashboardView.vue.
function onTileError(loi: boolean): void {
  if (loi) toastStore.showToast('Không tải được nền bản đồ — vị trí các marker vẫn chính xác')
}

onMounted(async () => {
  await taiDoiCuaMinh()
  await taiDanhSachNhiemVu()
  connect(CONFIG.socketUrl)
})

onUnmounted(() => {
  dungTheoDoiGps()
})
</script>

<template>
  <div class="rescuer-page">
    <header class="rescuer-top">
      <h1>Nhiệm vụ cứu hộ</h1>
      <div class="rescuer-top-right">
        <span class="realtime-status" :class="{ connected: isConnected }">
          <span class="dot"></span>{{ isConnected ? 'Thời gian thực: đang bật' : 'Thời gian thực: mất kết nối' }}
        </span>
        <span class="rescuer-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
      </div>
    </header>

    <main class="rescuer-body">
      <div v-if="loadingTeam || loadingSos" class="panel-empty">Đang tải...</div>
      <div v-else-if="!myTeamId" class="panel-empty">
        Tài khoản này chưa được gán làm trưởng đội cứu hộ nào.
      </div>
      <div v-else-if="sosList.length === 0" class="panel-empty">Chưa có nhiệm vụ nào được phân công.</div>

      <template v-else>
        <div class="rescuer-map">
          <RescueMap
            :sos-list="sosList"
            :teams="KHONG_VE_DOI"
            :selected-sos-id="selectedSos?.id ?? null"
            :route="route"
            @select-sos="chonNhiemVu"
            @tile-error="onTileError"
          />
        </div>
        <p class="map-hint">
          {{
            lastPosition
              ? 'Nét đứt là đường chim bay, không phải tuyến đường bộ — bấm "Chỉ đường" để được dẫn đường thật.'
              : 'Đang chờ vị trí GPS của bạn để vẽ đường tới nạn nhân...'
          }}
        </p>

        <ul class="sos-list">
          <li
            v-for="sos in sosList"
            :key="sos.id"
            class="sos-card"
            :class="[`status-${sos.status}`, { active: sos.id === selectedSos?.id }]"
            @click="chonNhiemVu(sos.id)"
          >
            <div class="sos-card-top">
              <span class="sos-badge">{{ SOS_TYPE_LABEL[sos.type] }}</span>
              <span class="sos-status-badge">{{ SOS_STATUS_LABEL[sos.status] }}</span>
            </div>

            <div class="sos-victim">{{ sos.victim_name }} · {{ sos.victim_phone }}</div>

            <p v-if="sos.location_estimated" class="sos-location-warn">
              ⚠️ Vị trí ước tính — nạn nhân không lấy được GPS chính xác, gọi điện xác nhận vị trí thật nếu có thể
            </p>
            <div class="sos-meta">
              <a :href="chiDuongLink(sos.lat, sos.lng)" target="_blank" rel="noopener noreferrer">
                {{ sos.lat.toFixed(5) }}, {{ sos.lng.toFixed(5) }} — Chỉ đường (Google Maps)
              </a>
            </div>
            <div v-if="quangDuong(sos)" class="sos-meta">{{ quangDuong(sos) }}</div>
            <div class="sos-meta">Gửi lúc {{ formatTime(sos.created_at) }}</div>
            <p v-if="sos.description" class="sos-desc">{{ sos.description }}</p>

            <button
              v-if="NEXT_ACTION[sos.status]"
              class="btn btn-primary"
              :disabled="updatingId === sos.id"
              @click="capNhat(sos)"
            >
              {{ updatingId === sos.id ? 'Đang cập nhật...' : NEXT_ACTION[sos.status]!.label }}
            </button>
          </li>
        </ul>
      </template>
    </main>

    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
  </div>
</template>

<style scoped>
.rescuer-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--fog);
}
/* style.css có rule toàn cục `header { position: fixed }` viết cho header trang chủ — áp
   nhầm lên cả header này, khiến nó không chiếm chỗ và phần đầu nội dung (bản đồ, thẻ đầu
   tiên) bị che dưới header. sticky: vẫn dính trên cùng khi cuộn nhưng chiếm chỗ bình thường. */
.rescuer-top {
  position: sticky;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.94);
}
.rescuer-top h1 {
  font-size: 18px;
}
.rescuer-top-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.rescuer-user {
  font-size: 13px;
  color: var(--pine-deep);
  font-weight: 500;
}
/* Class name riêng (không phải .socket-status) để tránh kế thừa style pill nổi
   (position: fixed, background trắng, box-shadow...) từ map-style.css — file đó định
   nghĩa .socket-status cho huy hiệu NỔI trên bản đồ ở MapView.vue (victim), khác hoàn
   toàn mục đích ở đây (mục text tĩnh trong header, nằm cạnh tên tài khoản). */
.realtime-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}
.realtime-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}
.realtime-status.connected .dot {
  background: #16a34a;
}

.rescuer-body {
  flex: 1;
  padding: 20px 24px 40px;
  max-width: 720px;
  width: 100%;
  margin: 0 auto;
}
.panel-empty {
  padding: 40px 20px;
  text-align: center;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}

/* position+z-index tạo stacking context riêng: các pane của Leaflet có z-index 400+, nếu
   không cô lập thì bản đồ vẽ ĐÈ lên header fixed (z-index 50) khi nằm/cuộn dưới header. */
.rescuer-map {
  position: relative;
  z-index: 0;
  height: 42vh;
  min-height: 260px;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: hidden;
}
.map-hint {
  margin: 8px 2px 14px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}

.sos-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sos-card {
  padding: 16px 18px;
  border: 1px solid var(--line);
  border-left: 4px solid transparent;
  border-radius: 10px;
  background: #fff;
  cursor: pointer;
}
.sos-card.active {
  box-shadow: 0 0 0 2px var(--pine-deep);
}
.sos-card.status-assigned {
  border-left-color: #f97316;
}
.sos-card.status-in_progress {
  border-left-color: #eab308;
}
.sos-card.status-arrived {
  border-left-color: #3b82f6;
}

.sos-card-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.sos-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--pine-deep);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sos-status-badge {
  font-size: 11px;
  color: rgba(42, 42, 36, 0.6);
}
.sos-victim {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 6px;
}
.sos-location-warn {
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
}
.sos-meta {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
  margin-bottom: 2px;
}
.sos-meta a {
  color: var(--pine-deep);
}
.sos-desc {
  margin-top: 8px;
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
}
.sos-card .btn {
  margin-top: 12px;
}
</style>
