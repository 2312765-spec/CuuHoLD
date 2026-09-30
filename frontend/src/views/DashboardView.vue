<script setup lang="ts">
// Bảng điều phối cứu hộ (commander) — bản đồ + danh sách SOS thời gian thực.
// Trái: RescueMap (marker SOS màu theo status + marker đội cứu hộ). Phải: danh sách SOS,
// click vào 1 SOS mở modal phân công đội gần nhất (GisService.timDoiGanNhat).

import { ref, computed, onMounted, watch } from 'vue'
import '@/assets/map-style.css'
import RescueMap from '@/components/map/RescueMap.vue'
import AnhHienTruong from '@/components/sos/AnhHienTruong.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { layDanhSachSos, phanCongDoi, xemChiTietSos } from '@/services/sosService'
import { timDoiGanNhat, layHeatmapSos } from '@/services/gisService'
import { fetchRescueTeams } from '@/services/rescueTeamsService'
import type { SosListItem, SosRequest, NearestTeam, RescueTeam, SosType, SosStatus } from '@/types'
import type { SosNewPayload, SosUpdatedPayload, TeamLocationPayload } from '@/shared/socket-events.types'
import { useSosDashboard } from '@/composables/useSosDashboard'
import { useSosStats } from '@/composables/useSosStats'

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

// F-MAP-02 lọc/tìm kiếm + F-DASH-02 xuất CSV — thao tác trên danh sách SOS đang có.
const { locLoai, locTrangThai, tuKhoa, danhSachLoc, dangLoc, xoaLoc, xuatCsv } =
  useSosDashboard(sosList, SOS_TYPE_LABEL, SOS_STATUS_LABEL)
const loaiOptions = Object.entries(SOS_TYPE_LABEL) as [SosType, string][]
const trangThaiOptions = Object.entries(SOS_STATUS_LABEL) as [SosStatus, string][]
// F-DASH-01 thống kê real-time (đếm theo trạng thái + loại) từ danh sách SOS.
const { tong, theoTrangThai, theoLoai } = useSosStats(sosList, SOS_TYPE_LABEL, SOS_STATUS_LABEL)

// ---------- F-MAP-03: chế độ bản đồ nhiệt (mật độ SOS theo khoảng thời gian) ----------
// diemNhiet: null = đang xem điểm SOS (gom cụm, F-MAP-05); mảng = đang xem bản đồ nhiệt.
const cheDoBanDo = ref<'diem' | 'nhiet'>('diem')
const soNgayNhiet = ref(7)
const diemNhiet = ref<[number, number, number][] | null>(null)
const dangTaiNhiet = ref(false)
const KHOANG_NHIET = [
  { soNgay: 1, nhan: '24 giờ' },
  { soNgay: 7, nhan: '7 ngày' },
  { soNgay: 30, nhan: '30 ngày' }
]

async function taiBanDoNhiet() {
  dangTaiNhiet.value = true
  try {
    const den = new Date()
    const tu = new Date(den.getTime() - soNgayNhiet.value * 24 * 60 * 60 * 1000)
    const diem = await layHeatmapSos(tu, den)
    // Người dùng có thể đã chuyển về chế độ điểm trong lúc chờ — không ghi đè.
    if (cheDoBanDo.value === 'nhiet') diemNhiet.value = diem
  } catch {
    // Interceptor http.ts đã hiện toast lỗi — quay về chế độ điểm để bản đồ không trống.
    cheDoBanDo.value = 'diem'
  } finally {
    dangTaiNhiet.value = false
  }
}

watch([cheDoBanDo, soNgayNhiet], ([cheDo]) => {
  if (cheDo === 'nhiet') void taiBanDoNhiet()
  else diemNhiet.value = null
})

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
    // Đang xem bản đồ nhiệt: thêm điểm mới tại chỗ, không gọi lại API cho mỗi SOS.
    if (diemNhiet.value) diemNhiet.value = [...diemNhiet.value, [item.lat, item.lng, 1]]
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
// Chi tiết SOS đang mở — GET /api/sos (danh sách) không trả mô tả/ảnh, nên trước đây commander
// phân công đội mà không đọc được mô tả nạn nhân gửi lẫn ảnh hiện trường (F-SOS-06).
const modalChiTiet = ref<SosRequest | null>(null)
const modalTeams = ref<NearestTeam[]>([])
const modalLoading = ref(false)
const assigningTeamId = ref<string | null>(null)
// Chỉ SOS đang CHỜ mới phân công được (backend assign() từ chối trạng thái khác, và
// timDoiGanNhat chỉ trả đội đang RẢNH). SOS đã có đội / đã kết thúc → modal chỉ xem chi tiết.
// Trước đây SOS nào cũng mở "Phân công đội" rồi tìm đội: đội được giao đang bận nên luôn ra
// "Không có đội nào sẵn sàng" ngay cạnh nhãn "Đã phân công" — rất dễ hiểu nhầm.
const coTheGiaoDoi = computed(() => modalSos.value?.status === 'pending')

async function openAssignModal(sos: SosListItem) {
  selectedSosId.value = sos.id
  modalSos.value = sos
  modalChiTiet.value = null
  modalTeams.value = []
  modalOpen.value = true
  modalLoading.value = true
  // Không chờ: danh sách đội gần nhất là việc chính của modal, mô tả/ảnh tải song song.
  xemChiTietSos(sos.id)
    .then((chiTiet) => {
      if (modalSos.value?.id === sos.id) modalChiTiet.value = chiTiet
    })
    .catch(() => {
      // http.ts đã hiện toast; modal vẫn phân công được bình thường.
    })
  if (sos.status !== 'pending') {
    modalLoading.value = false
    return
  }
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
  modalChiTiet.value = null
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
        <RouterLink to="/ho-so" class="dashboard-user" title="Hồ sơ của tôi">{{ authStore.user?.name }}</RouterLink>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
        <RouterLink to="/map" class="dashboard-close" aria-label="Đóng bảng điều phối">✕</RouterLink>
      </div>
    </header>

    <div class="dashboard-body">
      <div class="dashboard-map">
        <!-- Bản đồ hiện đúng danh sách ĐÃ LỌC (F-MAP-02) để khớp với cột bên phải. -->
        <RescueMap
          :sos-list="danhSachLoc"
          :teams="teams"
          :selected-sos-id="selectedSosId"
          :gom-cum="true"
          :heatmap="diemNhiet"
          @select-sos="onSelectSosFromMap"
          @tile-error="onTileError"
        />
        <div class="map-che-do">
          <div class="map-che-do__nhom" role="radiogroup" aria-label="Cách hiển thị SOS trên bản đồ">
            <button
              type="button"
              role="radio"
              :aria-checked="cheDoBanDo === 'diem'"
              :class="{ 'is-active': cheDoBanDo === 'diem' }"
              @click="cheDoBanDo = 'diem'"
            >Điểm SOS</button>
            <button
              type="button"
              role="radio"
              :aria-checked="cheDoBanDo === 'nhiet'"
              :class="{ 'is-active': cheDoBanDo === 'nhiet' }"
              @click="cheDoBanDo = 'nhiet'"
            >Mật độ</button>
          </div>
          <template v-if="cheDoBanDo === 'nhiet'">
            <select v-model.number="soNgayNhiet" aria-label="Khoảng thời gian bản đồ nhiệt">
              <option v-for="k in KHOANG_NHIET" :key="k.soNgay" :value="k.soNgay">{{ k.nhan }}</option>
            </select>
            <p v-if="dangTaiNhiet" class="map-che-do__ghi-chu" aria-live="polite">Đang tải…</p>
            <p v-else-if="diemNhiet && diemNhiet.length === 0" class="map-che-do__ghi-chu">
              Không có SOS nào trong khoảng này.
            </p>
            <div v-else class="map-che-do__thang" aria-hidden="true">
              <span>Thưa</span><span class="map-che-do__mau"></span><span>Dày</span>
            </div>
          </template>
        </div>
      </div>

      <aside class="dashboard-panel">
        <section v-if="tong > 0" class="dash-stats" aria-label="Thống kê SOS">
          <div class="stat-cards">
            <div class="stat-card stat-total">
              <span class="stat-num">{{ tong }}</span><span class="stat-lbl">Tổng SOS</span>
            </div>
            <div v-for="t in theoTrangThai" :key="t.key" class="stat-card" :class="`sc-${t.key}`">
              <span class="stat-num">{{ t.count }}</span><span class="stat-lbl">{{ t.label }}</span>
            </div>
          </div>
          <div v-if="theoLoai.length" class="stat-bars">
            <div class="stat-bars-title">SOS theo loại</div>
            <div v-for="l in theoLoai" :key="l.key" class="stat-bar-row">
              <span class="stat-bar-lbl">{{ l.label }}</span>
              <span class="stat-bar-track"><span class="stat-bar-fill" :style="{ width: l.percent + '%' }" /></span>
              <span class="stat-bar-val">{{ l.count }}</span>
            </div>
          </div>
        </section>
        <div class="panel-head">
          <h2>Yêu cầu SOS ({{ danhSachLoc.length }}<span v-if="dangLoc">/{{ sosList.length }}</span>)</h2>
          <button class="dash-export" type="button" :disabled="danhSachLoc.length === 0" @click="xuatCsv">⤓ Xuất CSV</button>
        </div>
        <div class="dash-filters">
          <input v-model="tuKhoa" class="dash-search" type="search" placeholder="Tìm theo tên hoặc SĐT..." aria-label="Tìm SOS" />
          <div class="dash-selects">
            <select v-model="locLoai" aria-label="Lọc theo loại">
              <option value="all">Mọi loại</option>
              <option v-for="[k, label] in loaiOptions" :key="k" :value="k">{{ label }}</option>
            </select>
            <select v-model="locTrangThai" aria-label="Lọc theo trạng thái">
              <option value="all">Mọi trạng thái</option>
              <option v-for="[k, label] in trangThaiOptions" :key="k" :value="k">{{ label }}</option>
            </select>
            <button v-if="dangLoc" class="dash-clear" type="button" @click="xoaLoc">Xoá lọc</button>
          </div>
        </div>
        <div v-if="loadingSos" class="panel-empty">Đang tải...</div>
        <div v-else-if="sosList.length === 0" class="panel-empty">Chưa có yêu cầu SOS nào.</div>
        <div v-else-if="danhSachLoc.length === 0" class="panel-empty">Không có SOS khớp bộ lọc.</div>
        <ul v-else class="sos-list">
          <li
            v-for="sos in danhSachLoc"
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
          <h3>{{ coTheGiaoDoi ? 'Phân công đội cứu hộ' : 'Chi tiết yêu cầu SOS' }}</h3>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <p v-if="modalSos" class="modal-sub">
          {{ SOS_TYPE_LABEL[modalSos.type] }} — {{ modalSos.victim_name }} ({{ modalSos.victim_phone }})
        </p>
        <p v-if="modalSos?.location_estimated" class="sos-location-warn">
          ⚠️ Vị trí ước tính — nạn nhân không lấy được GPS chính xác lúc gửi. Đội gần nhất bên
          dưới được tính theo toạ độ này, có thể không sát vị trí thật.
        </p>
        <p v-if="modalChiTiet?.description" class="modal-mo-ta">{{ modalChiTiet.description }}</p>
        <AnhHienTruong v-if="modalChiTiet?.image_url" :sos-id="modalChiTiet.id" />

        <dl v-if="modalSos && !coTheGiaoDoi" class="modal-tinh-trang">
          <div>
            <dt>Trạng thái</dt>
            <dd>{{ SOS_STATUS_LABEL[modalSos.status] }}</dd>
          </div>
          <div v-if="modalSos.status !== 'cancelled' && modalSos.status !== 'false_alarm'">
            <dt>Đội phụ trách</dt>
            <dd>{{ modalChiTiet ? (modalChiTiet.team_name ?? '—') : 'Đang tải...' }}</dd>
          </div>
        </dl>
        <template v-else>
          <div v-if="modalLoading" class="panel-empty">Đang tìm đội gần nhất...</div>
          <div v-else-if="modalTeams.length === 0" class="panel-empty">
            Không có đội nào đang rảnh gần khu vực này (đội đang làm nhiệm vụ không được tính).
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
        </template>
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
  gap: 16px;
}
.dashboard-user {
  font-size: 13px;
  color: var(--pine-deep);
  font-weight: 500;
}
/* F-UI-01: tên là lối vào trang hồ sơ. */
.dashboard-user {
  text-decoration: none;
}
.dashboard-user:hover {
  text-decoration: underline;
}
.dashboard-user:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: 2px;
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
  position: relative;
}
/* Bảng chọn chế độ bản đồ (F-MAP-03/05) — góc trên phải, trên các pane Leaflet (z 400+). */
.map-che-do {
  position: absolute;
  top: 10px;
  right: 10px;
  z-index: 800;
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  background: var(--fog, #f6f1e7);
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
  font-size: 13px;
  color: var(--ink, #2a2a24);
}
.map-che-do__nhom {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border: 1px solid var(--line, #d8d0bd);
  border-radius: 8px;
  overflow: hidden;
}
.map-che-do__nhom button {
  min-height: 36px;
  padding: 0 10px;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  cursor: pointer;
}
.map-che-do__nhom button.is-active {
  background: var(--pine-deep, #1f3d2e);
  color: #ffffff;
  font-weight: 600;
}
.map-che-do select {
  min-height: 34px;
  border: 1px solid var(--line, #d8d0bd);
  border-radius: 6px;
  background: #ffffff;
  color: #2a2a24;
  font: inherit;
}
.map-che-do button:focus-visible,
.map-che-do select:focus-visible {
  outline: 3px solid var(--pine-deep, #1f3d2e);
  outline-offset: 2px;
}
.map-che-do__ghi-chu {
  margin: 0;
  font-size: 12px;
}
.map-che-do__thang {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
}
.map-che-do__mau {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, #2c7bb6, #abd9e9, #fee090, #fdae61, #d7191c);
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

.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dash-export { border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 8px; padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.dash-export:hover:not(:disabled) { border-color: var(--ink); }
.dash-export:disabled { opacity: 0.45; cursor: not-allowed; }
/* Cùng lề 20px với .panel-head và .sos-item — trước đây padding 0 (bộ lọc) / 4px (thống kê) nên
   ô tìm kiếm, 2 ô chọn và biểu đồ dính sát 2 mép khung, "Xoá lọc" như bị cắt ở mép phải. */
.dash-filters { display: flex; flex-direction: column; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--line); }
.dash-search { width: 100%; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; font-family: inherit; background: var(--fog); color: var(--ink); }
.dash-selects { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.dash-selects select { flex: 1; min-width: 120px; min-height: 36px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 13px; font-family: inherit; background: var(--fog); color: var(--ink); cursor: pointer; }
.dash-clear { border: none; background: none; color: var(--clay); font-size: 13px; cursor: pointer; white-space: nowrap; }
.dash-clear:hover { text-decoration: underline; }

.dash-stats { padding: 14px 20px 12px; border-bottom: 1px solid var(--line); }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(74px, 1fr)); gap: 8px; margin-bottom: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 10px; background: var(--fog); border: 1px solid var(--line); }
.stat-num { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; line-height: 1; color: var(--pine-deep); }
.stat-lbl { font-size: 11px; color: rgba(42,42,36,0.6); }
.stat-total { background: var(--pine-deep); border-color: var(--pine-deep); }
.stat-total .stat-num { color: var(--fog); }
.stat-total .stat-lbl { color: rgba(245,241,230,0.7); }
.sc-pending .stat-num { color: var(--clay); }
.sc-in_progress .stat-num { color: #d99a35; }
.sc-resolved .stat-num { color: #2f7d4f; }
.stat-bars-title { font-size: 12px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.stat-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.stat-bar-lbl { flex: 0 0 84px; font-size: 12px; color: rgba(42,42,36,0.7); }
.stat-bar-track { flex: 1; height: 8px; border-radius: 5px; background: var(--line); overflow: hidden; }
.stat-bar-fill { display: block; height: 100%; border-radius: 5px; background: var(--clay); transition: width 0.3s ease; }
.stat-bar-val { flex: 0 0 24px; text-align: right; font-size: 12px; font-weight: 600; color: var(--ink); }

:root[data-theme="dark"] .stat-card { background: rgba(255,255,255,0.04); border-color: rgba(236,231,217,0.14); }
:root[data-theme="dark"] .stat-num { color: #ece7d9; }
:root[data-theme="dark"] .stat-lbl,
:root[data-theme="dark"] .stat-bar-lbl { color: rgba(236,231,217,0.7); }
:root[data-theme="dark"] .stat-total { background: rgba(127,174,140,0.16); border-color: rgba(127,174,140,0.3); }
:root[data-theme="dark"] .stat-total .stat-num { color: #f3efe3; }
:root[data-theme="dark"] .stat-total .stat-lbl { color: rgba(236,231,217,0.75); }
:root[data-theme="dark"] .stat-bars-title,
:root[data-theme="dark"] .stat-bar-val { color: #ece7d9; }

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
/* Mô tả nạn nhân gửi kèm SOS (F-SOS-06) — giữ xuống dòng như người gửi gõ. */
.modal-tinh-trang {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  font-size: 14px;
}
.modal-tinh-trang div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.modal-tinh-trang dt {
  color: rgba(42, 42, 36, 0.65);
}
.modal-tinh-trang dd {
  margin: 0;
  font-weight: 600;
}
.modal-mo-ta {
  margin: 8px 0 0;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(42, 42, 36, 0.05);
  font-size: 13px;
  white-space: pre-wrap;
}
</style>