<script setup lang="ts">
// Danh sách nhiệm vụ (rescuer) — SOS đang được phân công cho đội mình phụ trách.
// Theo dõi GPS: khi có SOS active (assigned/in_progress/arrived), watchPosition() giữ
// toạ độ mới nhất, setInterval 30s gửi định kỳ lên PATCH /api/rescue-teams/:id/location
// (CLAUDE.md Mục 8: "Rescuer gửi GPS mỗi 30 giây").

import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { layDanhSachSos, xemChiTietSos, capNhatTienDo } from '@/services/sosService'
import { fetchRescueTeams, capNhatViTriDoi } from '@/services/rescueTeamsService'
import type { SosRequest, SosType, SosStatus } from '@/types'
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

function googleMapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`
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
        <span class="socket-status" :class="{ connected: isConnected }">
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

      <ul v-else class="sos-list">
        <li v-for="sos in sosList" :key="sos.id" class="sos-card" :class="`status-${sos.status}`">
          <div class="sos-card-top">
            <span class="sos-badge">{{ SOS_TYPE_LABEL[sos.type] }}</span>
            <span class="sos-status-badge">{{ SOS_STATUS_LABEL[sos.status] }}</span>
          </div>

          <div class="sos-victim">{{ sos.victim_name }} · {{ sos.victim_phone }}</div>

          <div class="sos-meta">
            <a :href="googleMapsLink(sos.lat, sos.lng)" target="_blank" rel="noopener noreferrer">
              {{ sos.lat.toFixed(5) }}, {{ sos.lng.toFixed(5) }} — Mở Google Maps
            </a>
          </div>
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
.rescuer-top {
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
.socket-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}
.socket-status .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #9ca3af;
}
.socket-status.connected .dot {
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
