<script setup lang="ts">
// Bảng điều phối cứu hộ (commander) — bản đồ + danh sách SOS thời gian thực.
// Trái: RescueMap (marker SOS màu theo status + marker đội cứu hộ). Phải: danh sách SOS,
// click vào 1 SOS mở modal phân công đội gần nhất (GisService.timDoiGanNhat).

import { ref, onMounted } from 'vue'
import '@/assets/map-style.css'
import RescueMap from '@/components/map/RescueMap.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { layDanhSachSos, phanCongDoi } from '@/services/sosService'
import { timDoiGanNhat } from '@/services/gisService'
import { fetchRescueTeams } from '@/services/rescueTeamsService'
import type { SosListItem, NearestTeam, RescueTeam, SosType, SosStatus } from '@/types'
import type { SosNewPayload, SosUpdatedPayload, TeamLocationPayload } from '@/shared/socket-events.types'

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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
}

// ---------- Danh sách SOS + đội cứu hộ hiển thị trên bản đồ ----------
const sosList = ref<SosListItem[]>([])
const loadingSos = ref(false)
const teams = ref<RescueTeam[]>([])
const selectedSosId = ref<string | null>(null)

async function taiDanhSachSos() {
  loadingSos.value = true
  try {
    sosList.value = await layDanhSachSos()
  } finally {
    loadingSos.value = false
  }
}

// GET /api/rescue-teams trả MỌI đội bất kể trạng thái — khác timDoiGanNhat() (chỉ đội
// 'available', dùng riêng cho modal phân công bên dưới). Trước đây bản đồ commander dùng
// nhầm timDoiGanNhat() nên đội đang bận đi cứu hộ — đúng đội cần theo dõi nhất — không
// hiện trên bản đồ.
async function taiTatCaDoi() {
  try {
    teams.value = await fetchRescueTeams()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server — giữ danh sách rỗng.
  }
}

// ---------- Socket.IO — cập nhật thời gian thực ----------
const { isConnected, connect } = useSocket({
  onSosNew: (data: SosNewPayload) => {
    const item: SosListItem = {
      id: data.sosId,
      type: data.type,
      status: data.status,
      ward_code: data.wardCode,
      created_at: data.createdAt,
      lat: data.lat,
      lng: data.lng,
      location_estimated: data.locationEstimated,
      victim_name: data.victimName,
      victim_phone: data.victimPhone
    }
    sosList.value = [item, ...sosList.value]
    toastStore.showToast(`SOS mới: ${item.victim_name} — ${SOS_TYPE_LABEL[item.type]}`)
  },
  onSosUpdated: (data: SosUpdatedPayload) => {
    const sos = sosList.value.find((s) => s.id === data.sosId)
    if (sos) sos.status = data.status
  },
  onTeamLocation: (data: TeamLocationPayload) => {
    const team = teams.value.find((t) => t.id === data.teamId)
    if (team) {
      team.lat = data.lat
      team.lng = data.lng
    }
  }
})

onMounted(() => {
  taiDanhSachSos()
  taiTatCaDoi()
  connect(CONFIG.socketUrl)
})

// ---------- Modal phân công đội ----------
const modalOpen = ref(false)
const modalSos = ref<SosListItem | null>(null)
const modalTeams = ref<NearestTeam[]>([])
const modalLoading = ref(false)
const assigningTeamId = ref<string | null>(null)

async function openAssignModal(sos: SosListItem) {
  selectedSosId.value = sos.id
  modalSos.value = sos
  modalTeams.value = []
  modalOpen.value = true
  modalLoading.value = true
  try {
    modalTeams.value = await timDoiGanNhat(sos.lat, sos.lng)
  } finally {
    modalLoading.value = false
  }
}

function onSelectSosFromMap(id: string) {
  const sos = sosList.value.find((s) => s.id === id)
  if (sos) openAssignModal(sos)
}

// Tile nền OSM lỗi — marker SOS/đội vẫn đúng vị trí (vector), chỉ nền raster thiếu.
// RescueMap.vue tự dedupe trước khi emit (xem loiTile/watch ở đó) nên ở đây không cần
// debounce lại lần nữa.
function onTileError(loi: boolean) {
  if (loi) toastStore.showToast('Không tải được nền bản đồ — vị trí các marker vẫn chính xác')
}

function closeModal() {
  modalOpen.value = false
  modalSos.value = null
  modalTeams.value = []
  selectedSosId.value = null
}

async function confirmAssign(team: NearestTeam) {
  if (!modalSos.value) return
  assigningTeamId.value = team.id
  try {
    const result = await phanCongDoi(modalSos.value.id, team.id)
    const sos = sosList.value.find((s) => s.id === result.sosId)
    if (sos) sos.status = result.status
    toastStore.showToast(`Đã phân công ${team.name} cho yêu cầu SOS`)
    closeModal()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: đội không còn available, SOS không pending).
  } finally {
    assigningTeamId.value = null
  }
}
</script>

<template>
  <div class="dashboard-page">
    <header class="dashboard-top">
      <h1>Bảng điều phối cứu hộ</h1>
      <div class="dashboard-top-right">
        <span class="realtime-status" :class="{ connected: isConnected }">
          <span class="dot"></span>{{ isConnected ? 'Thời gian thực: đang bật' : 'Thời gian thực: mất kết nối' }}
        </span>
        <span class="dashboard-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
      </div>
    </header>

    <div class="dashboard-body">
      <div class="dashboard-map">
        <RescueMap
          :sos-list="sosList"
          :teams="teams"
          :selected-sos-id="selectedSosId"
          @select-sos="onSelectSosFromMap"
          @tile-error="onTileError"
        />
      </div>

      <aside class="dashboard-panel">
        <div class="panel-head">
          <h2>Yêu cầu SOS ({{ sosList.length }})</h2>
        </div>
        <div v-if="loadingSos" class="panel-empty">Đang tải...</div>
        <div v-else-if="sosList.length === 0" class="panel-empty">Chưa có yêu cầu SOS nào.</div>
        <ul v-else class="sos-list">
          <li
            v-for="sos in sosList"
            :key="sos.id"
            class="sos-item"
            :class="[`status-${sos.status}`, { active: sos.id === selectedSosId }]"
            @click="openAssignModal(sos)"
          >
            <div class="sos-item-top">
              <span class="sos-badge">{{ SOS_TYPE_LABEL[sos.type] }}</span>
              <span class="sos-status-badge">{{ SOS_STATUS_LABEL[sos.status] }}</span>
            </div>
            <div class="sos-victim">{{ sos.victim_name }} · {{ sos.victim_phone }}</div>
            <p v-if="sos.location_estimated" class="sos-location-warn">⚠️ Vị trí ước tính</p>
            <div class="sos-meta">Xã/phường {{ sos.ward_code }} · {{ formatTime(sos.created_at) }}</div>
          </li>
        </ul>
      </aside>
    </div>

    <!-- Modal phân công đội -->
    <div v-if="modalOpen" class="modal-overlay open" @click.self="closeModal">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Phân công đội cứu hộ</h3>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <p v-if="modalSos" class="modal-sub">
          {{ SOS_TYPE_LABEL[modalSos.type] }} — {{ modalSos.victim_name }} ({{ modalSos.victim_phone }})
        </p>
        <p v-if="modalSos?.location_estimated" class="sos-location-warn">
          ⚠️ Vị trí ước tính — nạn nhân không lấy được GPS chính xác lúc gửi. Đội gần nhất bên
          dưới được tính theo toạ độ này, có thể không sát vị trí thật.
        </p>

        <div v-if="modalLoading" class="panel-empty">Đang tìm đội gần nhất...</div>
        <div v-else-if="modalTeams.length === 0" class="panel-empty">
          Không có đội nào sẵn sàng gần khu vực này.
        </div>
        <ul v-else class="team-list">
          <li v-for="team in modalTeams" :key="team.id" class="team-item">
            <div>
              <b>{{ team.name }}</b>
              <span class="team-meta">
                {{ (team.distance_meters / 1000).toFixed(1) }} km · ~{{ team.eta_minutes }} phút · {{ team.leader_name }}
              </span>
            </div>
            <button
              class="btn btn-primary"
              :disabled="assigningTeamId === team.id"
              @click="confirmAssign(team)"
            >
              {{ assigningTeamId === team.id ? 'Đang phân công...' : 'Phân công' }}
            </button>
          </li>
        </ul>
      </div>
    </div>

    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
  </div>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--fog);
}
.dashboard-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.94);
}
.dashboard-top h1 {
  font-size: 18px;
}
.dashboard-top-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.dashboard-user {
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

.dashboard-body {
  flex: 1;
  display: flex;
  min-height: 0;
}
.dashboard-map {
  flex: 0 0 60%;
  max-width: 60%;
  height: 100%;
}
.dashboard-panel {
  flex: 0 0 40%;
  max-width: 40%;
  height: 100%;
  overflow-y: auto;
  border-left: 1px solid var(--line);
  background: #fff;
}

.panel-head {
  padding: 16px 20px;
  border-bottom: 1px solid var(--line);
}
.panel-head h2 {
  font-size: 15px;
}
.panel-empty {
  padding: 24px 20px;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}

.sos-list {
  list-style: none;
}
.sos-item {
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  border-left: 4px solid transparent;
  cursor: pointer;
  transition: background 0.15s;
}
.sos-item:hover,
.sos-item.active {
  background: var(--fog-dim);
}
.sos-item.status-pending {
  border-left-color: #dc2626;
}
.sos-item.status-assigned {
  border-left-color: #f97316;
}
.sos-item.status-in_progress {
  border-left-color: #eab308;
}
.sos-item.status-arrived {
  border-left-color: #3b82f6;
}
.sos-item.status-resolved {
  border-left-color: #16a34a;
}
.sos-item.status-cancelled,
.sos-item.status-false_alarm {
  border-left-color: #9ca3af;
}

.sos-item-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
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
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}
.sos-location-warn {
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 6px;
  padding: 4px 8px;
  margin: 4px 0;
  display: inline-block;
}
.sos-meta {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}

.modal-sub {
  font-size: 13px;
  color: rgba(42, 42, 36, 0.65);
  margin-bottom: 18px;
}
.team-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.team-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 10px;
}
.team-item b {
  display: block;
  font-size: 14px;
}
.team-meta {
  display: block;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
  margin-top: 2px;
}

@media (max-width: 900px) {
  .dashboard-body {
    flex-direction: column;
  }
  .dashboard-map,
  .dashboard-panel {
    flex: none;
    max-width: 100%;
    width: 100%;
  }
  .dashboard-map {
    height: 45vh;
  }
  .dashboard-panel {
    height: 55vh;
    border-left: none;
    border-top: 1px solid var(--line);
  }
}
</style>
