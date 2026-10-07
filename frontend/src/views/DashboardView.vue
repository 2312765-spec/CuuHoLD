<script setup lang="ts">
// Bảng điều phối cứu hộ (commander) — bản đồ + danh sách SOS thời gian thực.
// Trái: RescueMap (marker SOS màu theo status + marker đội cứu hộ). Phải: danh sách SOS,
// click vào 1 SOS mở modal phân công đội gần nhất (GisService.timDoiGanNhat).

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import '@/assets/map-style.css'
import RescueMap from '@/components/map/RescueMap.vue'
import ReportModerationPanel from '@/components/report/ReportModerationPanel.vue'
import { HAZARD_TYPES, HAZARD_TYPE_LABEL } from '@/constants/hazardLabels'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { layDanhSachSos, phanCongDoi } from '@/services/sosService'
import { timDoiGanNhat, layThongKeSosTheoXa } from '@/services/gisService'
import { fetchRescueTeams } from '@/services/rescueTeamsService'
import { layTatCaCanhBao, taoCanhBao, giaiQuyetCanhBao } from '@/services/hazardsService'
import { layBaoCaoDeKiemDuyet } from '@/services/hazardReportsService'
import type {
  SosListItem,
  NearestTeam,
  RescueTeam,
  SosType,
  SosStatus,
  SosHeatmapPoint,
  Hazard,
  HazardType,
  HazardSeverity,
  HazardReportAdmin
} from '@/types'
import type {
  SosNewPayload,
  SosUpdatedPayload,
  TeamLocationPayload,
  HazardReportNewPayload,
  HazardReportReviewedPayload
} from '@/shared/socket-events.types'

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
      // Gán cả khi undefined — đội vừa xong nhiệm vụ thì phải xoá ETA cũ khỏi tooltip.
      team.distanceToVictim = data.distanceToVictim
      team.estimatedArrival = data.estimatedArrival
    }
  },
  // Báo cáo cộng đồng: server chỉ bắn hai sự kiện này vào phòng commander.
  onHazardReportNew: (data: HazardReportNewPayload) => onHazardReportNew(data),
  onHazardReportReviewed: (data: HazardReportReviewedPayload) => onHazardReportReviewed(data)
})

onMounted(() => {
  taiDanhSachSos()
  taiTatCaDoi()
  void taiCanhBao()
  void taiBaoCaoChoDuyet()
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

// ---------- Thống kê SOS theo xã (heatmap) — commander tự bật, không tải mặc định để đỡ tốn
// 1 lượt gọi API cho phần đa số commander không cần xem ngay lúc mở trang ----------
const hienThongKe = ref(false)
const heatmapData = ref<SosHeatmapPoint[]>([])
const dangTaiThongKe = ref(false)
const SO_NGAY_THONG_KE = 30

async function taiThongKe(): Promise<void> {
  dangTaiThongKe.value = true
  try {
    const to = new Date()
    const from = new Date(to.getTime() - SO_NGAY_THONG_KE * 24 * 60 * 60 * 1000)
    heatmapData.value = await layThongKeSosTheoXa(from, to)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server — giữ dữ liệu cũ (nếu có).
  } finally {
    dangTaiThongKe.value = false
  }
}

function toggleThongKe(): void {
  hienThongKe.value = !hienThongKe.value
  // Chỉ tải lần đầu bật — bấm tắt/bật lại nhiều lần không gọi lại API thừa. Muốn dữ liệu mới
  // hơn (VD: xem lại vài phút sau) thì tự tắt/bật lại — chưa cần nút "làm mới" riêng.
  if (hienThongKe.value && heatmapData.value.length === 0) void taiThongKe()
}

// Tile nền OSM lỗi — marker SOS/đội vẫn đúng vị trí (vector), chỉ nền raster thiếu.
// RescueMap.vue tự dedupe trước khi emit (xem loiTile/watch ở đó) nên ở đây không cần
// debounce lại lần nữa.
function onTileError(loi: boolean) {
  if (loi) toastStore.showToast('Không tải được nền bản đồ — vị trí các marker vẫn chính xác')
}

// ---------- Cảnh báo/chặn đường (sạt lở, cây đổ...) — tab thứ 2 của panel bên phải ----------
const panelTab = ref<'sos' | 'hazards' | 'reports'>('sos')
const hazards = ref<Hazard[]>([])
const loadingHazards = ref(false)
// Tải cả active+resolved 1 lần lúc mount (không lazy theo tab) vì bản đồ cần hiện cảnh báo
// active NGAY từ đầu, không chỉ khi commander bấm mở tab quản lý.
const hazardsActive = computed(() => hazards.value.filter((h) => h.is_active))

// chayNen=true: làm mới do socket kích hoạt — không bật cờ "đang tải" để danh sách đang đọc không bị
// thay bằng chữ "Đang tải..." giữa chừng.
async function taiCanhBao(chayNen = false): Promise<void> {
  if (!chayNen) loadingHazards.value = true
  try {
    hazards.value = await layTatCaCanhBao()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  } finally {
    loadingHazards.value = false
  }
}

// Chế độ "chọn điểm đặt cảnh báo" — bật thì RescueMap đổi con trỏ crosshair, click lên bản đồ
// emit pick-location (xem RescueMap.vue) thay vì các hành vi khác.
const placingHazard = ref(false)
const hazardFormOpen = ref(false)
const hazardFormLat = ref(0)
const hazardFormLng = ref(0)
const hazardFormType = ref<HazardType>('landslide')
const hazardFormSeverity = ref<HazardSeverity>('blocked')
const hazardFormDescription = ref('')
const hazardFormRadius = ref(200)
const savingHazard = ref(false)
const resolvingHazardId = ref<string | null>(null)

// ---------- Báo cáo cộng đồng (tab 3): hàng đợi + thông báo realtime ----------
// Báo cáo từ người dân/tình nguyện viên nằm ở trạng thái "chờ duyệt" (điểm "?" vàng trên bản đồ,
// chỉ commander thấy) và CHƯA ảnh hưởng gì tới bản đồ chung hay thuật toán tìm đường cho tới khi
// commander duyệt. Giao diện duyệt/từ chối/lịch sử nằm ở ReportModerationPanel.vue; ở đây chỉ giữ
// hàng đợi (bản đồ cũng cần vẽ điểm chờ duyệt) và nhận sự kiện socket.
const reports = ref<HazardReportAdmin[]>([])
const loadingReports = ref(false)
const selectedReportId = ref<string | null>(null)
// Tăng mỗi khi có commander duyệt/từ chối → bảng kiểm duyệt làm mới phần lịch sử đang xem.
const historyVersion = ref(0)
// Tab "Báo cáo chờ duyệt" nhấp nháy khi có báo cáo mới mà commander đang ở tab khác.
const coBaoCaoMoi = ref(false)

async function taiBaoCaoChoDuyet(chayNen = false): Promise<void> {
  if (!chayNen) loadingReports.value = true
  try {
    reports.value = await layBaoCaoDeKiemDuyet('pending', { limit: 100 })
    // Mục đang mở vừa bị commander khác xử lý mất → bỏ chọn, đừng giữ id mồ côi.
    if (selectedReportId.value && !reports.value.some((r) => r.id === selectedReportId.value)) {
      selectedReportId.value = null
    }
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  } finally {
    loadingReports.value = false
  }
}

// Báo cáo mới (hoặc báo cáo trùng được gộp vào báo cáo chính). Chỉ báo + làm mới hàng đợi; KHÔNG tự
// chuyển tab của commander (đang xử lý SOS thì không nên bị giật sang chỗ khác).
function onHazardReportNew(p: HazardReportNewPayload): void {
  const loai = HAZARD_TYPE_LABEL[p.type]
  toastStore.showToast(
    p.mergedIntoReportId
      ? `Thêm người báo cáo trùng: ${loai} — ${p.reporterName} (${p.reporterCount} người cùng báo)`
      : `Báo cáo mới chờ duyệt: ${loai} — ${p.reporterName}`
  )
  if (panelTab.value !== 'reports') coBaoCaoMoi.value = true
  void taiBaoCaoChoDuyet(true)
}

// Một commander (có thể là chính mình ở tab khác) vừa duyệt/từ chối → đồng bộ hàng đợi, lịch sử, và
// danh sách cảnh báo nếu vừa duyệt (cảnh báo mới hiện trên bản đồ).
function onHazardReportReviewed(p: HazardReportReviewedPayload): void {
  void taiBaoCaoChoDuyet(true)
  historyVersion.value += 1
  if (p.status === 'approved') void taiCanhBao(true)
}

function boBaoCaoKhoiHangDoi(id: string): void {
  reports.value = reports.value.filter((x) => x.id !== id)
  if (selectedReportId.value === id) selectedReportId.value = null
}

function nhanGop(mergedCount: number): string {
  return mergedCount > 0 ? ` (gộp ${mergedCount} báo cáo trùng)` : ''
}

function onReportApproved(p: { reportId: string; hazard: Hazard; mergedCount: number }): void {
  hazards.value = [p.hazard, ...hazards.value.filter((h) => h.id !== p.hazard.id)]
  boBaoCaoKhoiHangDoi(p.reportId)
  historyVersion.value += 1
  toastStore.showToast(
    p.hazard.severity === 'blocked'
      ? `Đã duyệt${nhanGop(p.mergedCount)}: cảnh báo ĐỎ hiện trên bản đồ chung, tuyến đường sẽ tự tránh`
      : `Đã duyệt${nhanGop(p.mergedCount)}: cảnh báo VÀNG hiện trên bản đồ chung`
  )
}

function onReportRejected(p: { reportId: string; mergedCount: number }): void {
  boBaoCaoKhoiHangDoi(p.reportId)
  historyVersion.value += 1
  toastStore.showToast(`Đã từ chối${nhanGop(p.mergedCount)} — không hiện lên bản đồ`)
}

// Bấm điểm "?" vàng trên bản đồ → mở đúng báo cáo đó ở tab kiểm duyệt.
function onSelectReportFromMap(id: string): void {
  if (!reports.value.some((x) => x.id === id)) return
  panelTab.value = 'reports'
  selectedReportId.value = id
}

watch(panelTab, (tab) => {
  if (tab === 'reports') coBaoCaoMoi.value = false
})

// Tiêu đề tab trình duyệt hiện số báo cáo chờ duyệt, "(2) Bản Đồ Cứu Trợ Lâm Đồng" — để commander
// để dashboard ở tab nền vẫn thấy có việc mới.
const tieuDeGoc = document.title
watch(
  () => reports.value.length,
  (n) => {
    document.title = n > 0 ? `(${n}) ${tieuDeGoc}` : tieuDeGoc
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  document.title = tieuDeGoc
})

function batDauDatCanhBao(): void {
  panelTab.value = 'hazards'
  placingHazard.value = true
  toastStore.showToast('Nhấp vào bản đồ để chọn vị trí cảnh báo')
}

function huyDatCanhBao(): void {
  placingHazard.value = false
}

function onPickHazardLocation(lat: number, lng: number): void {
  placingHazard.value = false
  hazardFormLat.value = lat
  hazardFormLng.value = lng
  hazardFormType.value = 'landslide'
  hazardFormSeverity.value = 'blocked'
  hazardFormDescription.value = ''
  hazardFormRadius.value = 200
  hazardFormOpen.value = true
}

function closeHazardForm(): void {
  hazardFormOpen.value = false
}

async function submitHazardForm(): Promise<void> {
  savingHazard.value = true
  try {
    const created = await taoCanhBao({
      type: hazardFormType.value,
      description: hazardFormDescription.value.trim() || undefined,
      lat: hazardFormLat.value,
      lng: hazardFormLng.value,
      radiusMeters: hazardFormRadius.value,
      severity: hazardFormSeverity.value
    })
    hazards.value = [created, ...hazards.value]
    toastStore.showToast('Đã tạo cảnh báo — thuật toán tìm đường sẽ tự tránh khu vực này')
    hazardFormOpen.value = false
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: validate radius/toạ độ).
  } finally {
    savingHazard.value = false
  }
}

async function xoaCanhBao(hazard: Hazard): Promise<void> {
  resolvingHazardId.value = hazard.id
  try {
    const updated = await giaiQuyetCanhBao(hazard.id)
    const idx = hazards.value.findIndex((h) => h.id === updated.id)
    if (idx !== -1) hazards.value[idx] = updated
    toastStore.showToast('Đã gỡ cảnh báo')
  } catch {
    // Interceptor http.ts đã hiện toast lỗi.
  } finally {
    resolvingHazardId.value = null
  }
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
      <div class="dashboard-top-left">
        <h1>Bảng điều phối cứu hộ</h1>
      </div>
      <div class="dashboard-top-right">
        <span class="realtime-status" :class="{ connected: isConnected }">
          <span class="dot"></span>{{ isConnected ? 'Thời gian thực: đang bật' : 'Thời gian thực: mất kết nối' }}
        </span>
        <button class="btn btn-ghost" :disabled="dangTaiThongKe" @click="toggleThongKe">
          {{ dangTaiThongKe ? 'Đang tải...' : hienThongKe ? 'Ẩn thống kê theo xã' : `Thống kê theo xã (${SO_NGAY_THONG_KE} ngày)` }}
        </button>
        <button v-if="!placingHazard" class="btn btn-ghost" @click="batDauDatCanhBao">
          + Đánh dấu cảnh báo
        </button>
        <button v-else class="btn btn-ghost btn-placing" @click="huyDatCanhBao">Huỷ chọn vị trí</button>
        <RouterLink to="/users" class="btn btn-ghost">Quản lý người dùng</RouterLink>
        <RouterLink to="/stats" class="btn btn-ghost">Thống kê</RouterLink>
        <RouterLink to="/system" class="btn btn-ghost">Hệ thống</RouterLink>
        <span class="dashboard-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
        <RouterLink to="/map" class="dashboard-close" aria-label="Đóng bảng điều phối">✕</RouterLink>
      </div>
    </header>

    <div class="dashboard-body">
      <div class="dashboard-map">
        <RescueMap
          :sos-list="sosList"
          :teams="teams"
          :selected-sos-id="selectedSosId"
          :heatmap="hienThongKe ? heatmapData : []"
          :hazards="hazardsActive"
          :placing-hazard="placingHazard"
          :pending-reports="reports"
          :selected-report-id="selectedReportId"
          @select-sos="onSelectSosFromMap"
          @tile-error="onTileError"
          @pick-location="onPickHazardLocation"
          @select-report="onSelectReportFromMap"
        />
      </div>

      <aside class="dashboard-panel">
        <div class="panel-head panel-head-tabs">
          <button
            class="panel-tab"
            :class="{ active: panelTab === 'sos' }"
            @click="panelTab = 'sos'"
          >
            Yêu cầu SOS ({{ sosList.length }})
          </button>
          <button
            class="panel-tab"
            :class="{ active: panelTab === 'hazards' }"
            @click="panelTab = 'hazards'"
          >
            Cảnh báo/chặn đường ({{ hazardsActive.length }})
          </button>
          <button
            class="panel-tab"
            :class="{ active: panelTab === 'reports', pulse: coBaoCaoMoi && panelTab !== 'reports' }"
            @click="panelTab = 'reports'"
          >
            Báo cáo chờ duyệt ({{ reports.length }})
          </button>
        </div>

        <template v-if="panelTab === 'sos'">
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
        </template>

        <template v-else-if="panelTab === 'hazards'">
          <div class="hazard-hint">
            Vòng tròn ĐỎ là vùng chặn đường — thuật toán tìm đường sẽ tự tránh. Vòng tròn VÀNG chỉ là
            cảnh báo cẩn trọng, không làm tuyến đi vòng. Bấm "+ Đánh dấu cảnh báo" ở trên rồi chọn
            1 điểm trên bản đồ để thêm.
          </div>
          <div v-if="loadingHazards" class="panel-empty">Đang tải...</div>
          <div v-else-if="hazards.length === 0" class="panel-empty">Chưa có cảnh báo nào.</div>
          <ul v-else class="hazard-list">
            <li
              v-for="h in hazards"
              :key="h.id"
              class="hazard-item"
              :class="[{ resolved: !h.is_active }, h.severity === 'caution' ? 'sev-caution' : '']"
            >
              <div class="hazard-item-top">
                <span class="sos-badge">
                  {{ HAZARD_TYPE_LABEL[h.type] }}
                  <span class="sev-tag" :class="`sev-tag--${h.severity}`">
                    {{ h.severity === 'caution' ? 'Vàng' : 'Đỏ' }}
                  </span>
                </span>
                <span v-if="!h.is_active" class="sos-status-badge">Đã gỡ</span>
              </div>
              <p v-if="h.description" class="hazard-desc">{{ h.description }}</p>
              <div class="sos-meta">
                Bán kính {{ h.radius_meters }}m · Xã/phường {{ h.ward_code ?? '—' }} · {{ formatTime(h.created_at) }}
              </div>
              <button
                v-if="h.is_active"
                class="btn btn-ghost btn-sm"
                :disabled="resolvingHazardId === h.id"
                @click="xoaCanhBao(h)"
              >
                {{ resolvingHazardId === h.id ? 'Đang gỡ...' : 'Gỡ cảnh báo' }}
              </button>
            </li>
          </ul>
        </template>

        <ReportModerationPanel
          v-else
          v-model:selected-id="selectedReportId"
          :pending="reports"
          :loading-pending="loadingReports"
          :history-version="historyVersion"
          @approved="onReportApproved"
          @rejected="onReportRejected"
          @need-refresh="taiBaoCaoChoDuyet()"
        />
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

    <!-- Modal tạo cảnh báo -->
    <div v-if="hazardFormOpen" class="modal-overlay open" @click.self="closeHazardForm">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Thêm cảnh báo/chặn đường</h3>
          <button class="modal-close" @click="closeHazardForm">✕</button>
        </div>
        <p class="modal-sub">
          Vị trí: {{ hazardFormLat.toFixed(5) }}, {{ hazardFormLng.toFixed(5) }}
        </p>

        <div class="hazard-form-field">
          <label for="hazard-type">Loại cảnh báo</label>
          <select id="hazard-type" v-model="hazardFormType">
            <option v-for="t in HAZARD_TYPES" :key="t" :value="t">{{ HAZARD_TYPE_LABEL[t] }}</option>
          </select>
        </div>

        <div class="hazard-form-field">
          <label for="hazard-severity">Mức độ</label>
          <select id="hazard-severity" v-model="hazardFormSeverity">
            <option value="blocked">Đỏ — chặn đường (tuyến đi sẽ tự tránh)</option>
            <option value="caution">Vàng — cẩn trọng (chỉ cảnh báo)</option>
          </select>
        </div>

        <div class="hazard-form-field">
          <label for="hazard-radius">Bán kính vùng ảnh hưởng (mét)</label>
          <input id="hazard-radius" v-model.number="hazardFormRadius" type="number" min="10" max="5000" step="10" />
        </div>

        <div class="hazard-form-field">
          <label for="hazard-desc">Mô tả (tuỳ chọn)</label>
          <textarea
            id="hazard-desc"
            v-model="hazardFormDescription"
            rows="2"
            maxlength="500"
            placeholder="VD: Sạt lở taluy dương, đá lăn xuống đường"
          ></textarea>
        </div>

        <button class="btn btn-primary hazard-form-submit" :disabled="savingHazard" @click="submitHazardForm">
          {{ savingHazard ? 'Đang lưu...' : 'Tạo cảnh báo' }}
        </button>
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
/* style.css có rule toàn cục `header { position: fixed }` viết cho header trang chủ — áp nhầm
   lên header này làm nó đè lên bản đồ/panel và che mất nút. sticky: chiếm chỗ bình thường. */
.dashboard-top {
  position: sticky;
  top: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.94);
}
.dashboard-top h1 {
  font-size: 18px;
}
.dashboard-top-left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.dashboard-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: #fff;
  color: var(--ink);
  font-size: 15px;
  text-decoration: none;
  transition: background 0.15s, border-color 0.15s;
}
.dashboard-close:hover {
  background: var(--fog-dim);
  border-color: var(--ink);
}
.dashboard-top-right {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px 12px;
}
/* Header có nhiều nút (thống kê, cảnh báo, người dùng, hệ thống...) — nút cỡ mặc định của
   style.css (padding 13px 26px) làm thanh tràn khỏi màn hình hẹp và che mất nút ở đầu thanh. */
.dashboard-top-right .btn {
  padding: 8px 14px;
  font-size: 13px;
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
/* contain: paint + overflow: hidden — chặn cứng nội dung Leaflet (pane có transform riêng) không
   vẽ tràn khỏi khung 60%; trước đây có lúc bản đồ lấn sang đè lên bảng bên phải (lỗi vẽ Chrome). */
.dashboard-map {
  position: relative;
  z-index: 0;
  overflow: hidden;
  contain: paint;
  flex: 0 0 60%;
  max-width: 60%;
  height: 100%;
}
.dashboard-panel {
  position: relative;
  z-index: 1;
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
.panel-head-tabs {
  display: flex;
  gap: 4px;
  padding: 10px 10px 0;
}
.panel-tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: transparent;
  border-bottom: 2px solid transparent;
  font-size: 13px;
  font-weight: 500;
  color: rgba(42, 42, 36, 0.55);
  cursor: pointer;
}
.panel-tab.active {
  color: var(--pine-deep);
  border-bottom-color: var(--pine-deep);
}
.panel-empty {
  padding: 24px 20px;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}

.btn-placing {
  border-color: #b91c1c;
  color: #b91c1c;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
  margin-top: 8px;
}

.hazard-hint {
  padding: 12px 20px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
  background: var(--fog-dim);
  border-bottom: 1px solid var(--line);
}
.hazard-list {
  list-style: none;
}
.hazard-item {
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  border-left: 4px solid #b91c1c;
}
/* Đã gỡ: phân biệt bằng viền xám + nhãn "Đã gỡ", chữ vẫn đủ rõ để đọc (không làm mờ nặng). */
.hazard-item.resolved {
  border-left-color: #9ca3af;
  background: #f7f7f5;
}
.hazard-item.resolved .hazard-desc,
.hazard-item.resolved .sos-meta {
  color: rgba(42, 42, 36, 0.7);
}
.hazard-item-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.hazard-desc {
  font-size: 13px;
  margin-bottom: 4px;
}

.sev-tag {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: none;
}
.sev-tag--blocked {
  background: #fee2e2;
  color: #991b1b;
}
.sev-tag--caution {
  background: #fef9c3;
  color: #854d0e;
}
.hazard-item.sev-caution {
  border-left-color: #eab308;
}
/* Có báo cáo mới mà đang ở tab khác: nhấp nháy tới khi commander mở tab. */
.panel-tab.pulse {
  color: #92400e;
  animation: tab-pulse 1.2s ease-in-out infinite;
}
@keyframes tab-pulse {
  0%,
  100% {
    background: transparent;
  }
  50% {
    background: #fef3c7;
  }
}
@media (prefers-reduced-motion: reduce) {
  .panel-tab.pulse {
    animation: none;
    background: #fef3c7;
  }
}
.hazard-form-field {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.hazard-form-field label {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.65);
}
.hazard-form-field select,
.hazard-form-field input,
.hazard-form-field textarea {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
}
.hazard-form-submit {
  width: 100%;
  justify-content: center;
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