<script setup lang="ts">
// Bảng điều phối cứu hộ (commander) — bản đồ + danh sách SOS thời gian thực.
// Trái: RescueMap (marker SOS màu theo status + marker đội cứu hộ). Phải: danh sách SOS,
// click vào 1 SOS mở modal phân công đội gần nhất (GisService.timDoiGanNhat).

import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import '@/assets/map-style.css'
import RescueMap from '@/components/map/RescueMap.vue'
import ViTriCuaToi from '@/components/map/ViTriCuaToi.vue'
import ChonXaPhuong from '@/components/map/ChonXaPhuong.vue'
import AnhHienTruong from '@/components/sos/AnhHienTruong.vue'
import ReportModerationPanel from '@/components/report/ReportModerationPanel.vue'
import { HAZARD_TYPES, HAZARD_TYPE_LABEL } from '@/constants/hazardLabels'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { useSocket } from '@/composables/useSocket'
import { CONFIG } from '@/config'
import { layDanhSachSos, phanCongDoi, xemChiTietSos } from '@/services/sosService'
import { timDoiGanNhat, layThongKeSosTheoXa, layHeatmapSos } from '@/services/gisService'
import { fetchRescueTeams } from '@/services/rescueTeamsService'
import { layTatCaCanhBao, taoCanhBao, giaiQuyetCanhBao } from '@/services/hazardsService'
import { layBaoCaoDeKiemDuyet } from '@/services/hazardReportsService'
import type {
  SosListItem,
  SosRequest,
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
import { useSosDashboard } from '@/composables/useSosDashboard'
import { useSosStats } from '@/composables/useSosStats'
import { useXaPhuong } from '@/composables/useXaPhuong'
import { useTenDuong } from '@/composables/useTenDuong'
import { useGhimViTri } from '@/composables/useGhimViTri'
import {
  NHAN_CACH_SAP_XEP,
  NHAN_MUC_DO,
  laSosDaKetThuc,
  mucDoSos,
  type CachSapXepSos
} from '@/constants/sosMucDo'

const authStore = useAuthStore()
const toastStore = useToastStore()
// Bản đồ thật bên trong RescueMap — để gắn nút "Vị trí của tôi" lên đúng bản đồ đó.
const banDoRef = ref<InstanceType<typeof RescueMap> | null>(null)
const banDo = computed(() => banDoRef.value?.mapInstance ?? null)

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
const { locLoai, locTrangThai, tuKhoa, locXa, sapXep, danhSachLoc, dangLoc, xoaLoc, xuatCsv } =
  useSosDashboard(sosList, SOS_TYPE_LABEL, SOS_STATUS_LABEL)
const sapXepOptions = Object.entries(NHAN_CACH_SAP_XEP) as [CachSapXepSos, string][]

// ---------- Thẻ SOS chi tiết: tên xã thay mã số, tên đường, ngày giờ đầy đủ + "x phút trước" ----------
const { tenXa } = useXaPhuong()
const { yeuCau: yeuCauTenDuong, tenDuong } = useTenDuong()
// Chỉ tra tên đường cho các thẻ đầu danh sách (đã xếp ca gấp nhất lên trên) — Nominatim giới hạn
// 1 lượt/giây, tra cả trăm SOS cũ một lúc vừa chậm vừa vô ích.
const SO_THE_TRA_DUONG = 30
watch(
  danhSachLoc,
  (ds) => {
    for (const s of ds.slice(0, SO_THE_TRA_DUONG)) yeuCauTenDuong(s.lat, s.lng)
  },
  { immediate: true }
)

// Đồng hồ cho "x phút trước" + đánh dấu SOS mới — 30 giây/lần là đủ, không cần chính xác tới giây.
const bayGio = ref(Date.now())
const dongHo = setInterval(() => {
  bayGio.value = Date.now()
}, 30_000)
onBeforeUnmount(() => clearInterval(dongHo))

function ngayGio(iso: string): string {
  const d = new Date(iso)
  const gio = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
  const ngay = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${gio} · ${ngay}`
}

function truocDo(iso: string): string {
  const phut = Math.max(0, Math.floor((bayGio.value - new Date(iso).getTime()) / 60_000))
  if (phut < 1) return 'vừa xong'
  if (phut < 60) return `${phut} phút trước`
  const gio = Math.floor(phut / 60)
  if (gio < 24) return `${gio} giờ trước`
  return `${Math.floor(gio / 24)} ngày trước`
}

// SOS chưa ai nhận và mới gửi trong 5 phút → thẻ nhấp nháy để commander thấy ngay.
const PHUT_LA_SOS_MOI = 5
function laSosMoi(sos: SosListItem): boolean {
  return (
    sos.status === 'pending' && bayGio.value - new Date(sos.created_at).getTime() < PHUT_LA_SOS_MOI * 60_000
  )
}

// Số ca nguy kịch/nặng còn đang mở — hiện ở đầu tab SOS để thấy ngay có bao nhiêu ca gấp.
const soCaGap = computed(
  () =>
    sosList.value.filter((s) => !laSosDaKetThuc(s.status) && ['nguy-kich', 'nang'].includes(mucDoSos(s.type)))
      .length
)
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

// ---------- Thống kê SOS theo xã (heatmap) — commander tự bật, không tải mặc định để đỡ tốn
// 1 lượt gọi API cho phần đa số commander không cần xem ngay lúc mở trang ----------
const hienThongKe = ref(false)
const heatmapData = ref<SosHeatmapPoint[]>([])
const dangTaiThongKe = ref(false)
// Trước đây cố định 30 ngày và chỉ vẽ vòng tròn lên bản đồ: dữ liệu thử cũ hơn 30 ngày → kết quả
// rỗng mà không báo gì, commander tưởng nút hỏng. Giờ chọn được khoảng, có bảng xếp hạng xã và
// câu báo rõ khi không có SOS nào trong khoảng đã chọn.
const SO_NGAY_THONG_KE_OPTIONS = [7, 30, 90, 365] as const
const soNgayThongKe = ref<number>(30)
const daTaiThongKe = ref(false)
const xepHangXa = computed(() =>
  [...heatmapData.value].sort((a, b) => b.incident_count - a.incident_count)
)
const tongVuThongKe = computed(() => heatmapData.value.reduce((t, p) => t + p.incident_count, 0))

async function taiThongKe(): Promise<void> {
  dangTaiThongKe.value = true
  try {
    const to = new Date()
    const from = new Date(to.getTime() - soNgayThongKe.value * 24 * 60 * 60 * 1000)
    heatmapData.value = await layThongKeSosTheoXa(from, to)
    daTaiThongKe.value = true
    vuaKhungThongKe()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server — giữ dữ liệu cũ (nếu có).
  } finally {
    dangTaiThongKe.value = false
  }
}

// Đưa mọi xã có SOS vào khung nhìn để commander thấy ngay vòng tròn thống kê.
function vuaKhungThongKe(): void {
  const map = banDo.value
  if (!map || heatmapData.value.length === 0) return
  const diem = heatmapData.value.map((p) => [Number(p.lat), Number(p.lng)] as [number, number])
  map.fitBounds(diem, { padding: [48, 48], maxZoom: 13 })
}

function bayToiXaThongKe(p: SosHeatmapPoint): void {
  banDo.value?.flyTo([Number(p.lat), Number(p.lng)], 13, { duration: 0.8 })
}

function toggleThongKe(): void {
  hienThongKe.value = !hienThongKe.value
  // Chỉ tải lần đầu bật; đổi khoảng thời gian trong bảng thì tải lại.
  if (hienThongKe.value && !daTaiThongKe.value) void taiThongKe()
}

watch(soNgayThongKe, () => {
  if (hienThongKe.value) void taiThongKe()
})

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

// Bấm thông báo "báo cáo mới" ở chuông (trang khác) → mở thẳng tab duyệt: /dashboard?tab=reports.
const route = useRoute()
watch(
  // ?. : vài test mount trang này không kèm router.
  () => route?.query.tab,
  (tab) => {
    if (tab === 'reports') panelTab.value = 'reports'
  },
  { immediate: true }
)

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

// Ghim KÉO ĐƯỢC để chọn vị trí cảnh báo — tái dùng đúng ghim của "Báo SOS hộ" (useGhimViTri).
// Trước đây chế độ này chỉ đổi con trỏ thành dấu + và chờ một cú click: không có gì hiện trên bản
// đồ, commander không biết phải bấm vào đâu, bấm lệch là mở form ngay với vị trí sai.
// Bấm nút là ghim xuất hiện NGAY ở giữa bản đồ — commander chỉ việc kéo ghim hoặc chạm chỗ khác.
// (Bản trước bắt bấm thêm "Ghim tại tâm bản đồ" khi đang xem cả tỉnh — thừa một bước, khó hiểu.)
const ghimCanhBao = useGhimViTri(banDo, placingHazard, undefined, 'Vị trí cảnh báo (kéo để chỉnh)')

watch(
  () => ghimCanhBao.viTriGhim.value,
  (v) => {
    if (v) yeuCauTenDuong(v.lat, v.lng)
  }
)

function batDauDatCanhBao(): void {
  panelTab.value = 'hazards'
  placingHazard.value = true
  ghimCanhBao.ghimTaiTamBanDo()
}

function huyDatCanhBao(): void {
  placingHazard.value = false
}

function xacNhanViTriCanhBao(): void {
  const v = ghimCanhBao.viTriGhim.value
  if (v) onPickHazardLocation(v.lat, v.lng)
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
        <button class="btn btn-ghost" :disabled="dangTaiThongKe" @click="toggleThongKe">
          {{ hienThongKe ? 'Ẩn thống kê theo xã' : 'Thống kê theo xã' }}
        </button>
        <button v-if="!placingHazard" class="btn btn-ghost" @click="batDauDatCanhBao">
          + Đánh dấu cảnh báo
        </button>
        <button v-else class="btn btn-ghost btn-placing" @click="huyDatCanhBao">Huỷ chọn vị trí</button>
        <RouterLink to="/users" class="btn btn-ghost">Quản lý người dùng</RouterLink>
        <RouterLink to="/stats" class="btn btn-ghost">Thống kê</RouterLink>
        <RouterLink to="/system" class="btn btn-ghost">Hệ thống</RouterLink>
        <RouterLink to="/" class="nav-thoat">Trang chủ</RouterLink>
        <RouterLink to="/map" class="nav-thoat">Xem bản đồ</RouterLink>
        <RouterLink to="/ho-so" class="dashboard-user" title="Hồ sơ của tôi">{{ authStore.user?.name }}</RouterLink>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
        <RouterLink to="/map" class="dashboard-close" aria-label="Đóng bảng điều phối">✕</RouterLink>
      </div>
    </header>

    <div class="dashboard-body">
      <div class="dashboard-map">
        <!-- Bản đồ hiện đúng danh sách ĐÃ LỌC (F-MAP-02) để khớp với cột bên phải. -->
        <RescueMap
          ref="banDoRef"
          :sos-list="danhSachLoc"
          :teams="teams"
          :selected-sos-id="selectedSosId"
          :thong-ke-xa="hienThongKe ? heatmapData : []"
          :hazards="hazardsActive"
          :pending-reports="reports"
          :selected-report-id="selectedReportId"
          :gom-cum="true"
          :heatmap="diemNhiet"
          @select-sos="onSelectSosFromMap"
          @tile-error="onTileError"
          @select-report="onSelectReportFromMap"
        />
        <ViTriCuaToi :map="banDo" />
        <!-- Chọn xã → bản đồ bay tới xã đó + danh sách SOS chỉ còn SOS trong xã (F-MAP-02). -->
        <ChonXaPhuong v-model="locXa" :map="banDo" />
        <!-- Bảng xếp hạng xã theo số SOS — đi kèm vòng tròn thống kê trên bản đồ. -->
        <section v-if="hienThongKe" class="thong-ke-xa" aria-labelledby="thong-ke-xa-title">
          <div class="thong-ke-xa__head">
            <h2 id="thong-ke-xa-title">SOS theo xã/phường</h2>
            <button type="button" class="thong-ke-xa__dong" aria-label="Ẩn thống kê theo xã" @click="toggleThongKe">✕</button>
          </div>
          <label class="thong-ke-xa__khoang">
            Trong
            <select v-model.number="soNgayThongKe" aria-label="Khoảng thời gian thống kê">
              <option v-for="n in SO_NGAY_THONG_KE_OPTIONS" :key="n" :value="n">
                {{ n === 365 ? '1 năm' : `${n} ngày` }}
              </option>
            </select>
            qua
          </label>
          <p v-if="dangTaiThongKe" class="thong-ke-xa__trong">Đang tải…</p>
          <p v-else-if="xepHangXa.length === 0" class="thong-ke-xa__trong">
            Không có SOS nào trong {{ soNgayThongKe === 365 ? '1 năm' : `${soNgayThongKe} ngày` }} qua.
            Thử chọn khoảng thời gian dài hơn.
          </p>
          <template v-else>
            <p class="thong-ke-xa__tong">{{ tongVuThongKe }} vụ ở {{ xepHangXa.length }} xã/phường</p>
            <ol class="thong-ke-xa__ds">
              <li v-for="p in xepHangXa" :key="p.ward_code">
                <button type="button" @click="bayToiXaThongKe(p)">
                  <span>{{ p.ward_name }}</span>
                  <b>{{ p.incident_count }}</b>
                </button>
              </li>
            </ol>
          </template>
        </section>
        <!-- Chọn vị trí cảnh báo: ghim kéo được + nút xác nhận, thay cho "click mò" trước đây. -->
        <section v-if="placingHazard" class="dat-ghim" aria-labelledby="dat-ghim-title">
          <div class="dat-ghim__head">
            <h2 id="dat-ghim-title">Chọn vị trí cảnh báo</h2>
            <button type="button" class="dat-ghim__dong" aria-label="Huỷ chọn vị trí" @click="huyDatCanhBao">✕</button>
          </div>
          <p class="dat-ghim__huong-dan">
            Kéo ghim (hoặc chạm vào bản đồ) tới đúng chỗ cần cảnh báo. Ở xa thì chọn xã/phường ở góc
            trái để bay tới nhanh.
          </p>
          <template v-if="ghimCanhBao.viTriGhim.value">
            <p class="dat-ghim__dia-chi">
              📍
              {{
                tenDuong(ghimCanhBao.viTriGhim.value.lat, ghimCanhBao.viTriGhim.value.lng) ??
                (tenDuong(ghimCanhBao.viTriGhim.value.lat, ghimCanhBao.viTriGhim.value.lng) === null
                  ? 'Không xác định được tên đường'
                  : 'Đang tìm tên đường…')
              }}
              <span class="dat-ghim__toa-do">
                {{ ghimCanhBao.viTriGhim.value.lat.toFixed(5) }}, {{ ghimCanhBao.viTriGhim.value.lng.toFixed(5) }}
              </span>
            </p>
          </template>
          <div class="dat-ghim__nut">
            <button
              type="button"
              class="btn btn-primary"
              :disabled="!ghimCanhBao.viTriGhim.value"
              @click="xacNhanViTriCanhBao"
            >
              Xác nhận vị trí
            </button>
          </div>
        </section>
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
        <div class="panel-head panel-head-tabs">
          <button
            class="panel-tab"
            :class="{ active: panelTab === 'sos' }"
            @click="panelTab = 'sos'"
          >
            🆘 Yêu cầu SOS ({{ sosList.length }})
            <span v-if="soCaGap > 0" class="tab-gap">{{ soCaGap }} ca gấp</span>
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

        <!-- Có báo cáo mới mà commander đang ở tab khác: dải nổi bật trên cùng, bấm là mở tab duyệt. -->
        <button
          v-if="coBaoCaoMoi && panelTab !== 'reports' && reports.length > 0"
          type="button"
          class="bao-cao-moi-bar"
          @click="panelTab = 'reports'"
        >
          🚧 Có {{ reports.length }} báo cáo chờ duyệt — bấm để xem
        </button>

        <template v-if="panelTab === 'sos'">
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
              <select v-model="sapXep" aria-label="Sắp xếp SOS">
                <option v-for="[k, label] in sapXepOptions" :key="k" :value="k">{{ label }}</option>
              </select>
              <button v-if="dangLoc" class="dash-clear" type="button" @click="xoaLoc">Xoá lọc</button>
            </div>
            <p v-if="locXa" class="dash-xa">Đang xem: {{ tenXa(locXa) }}</p>
          </div>
          <div v-if="loadingSos" class="panel-empty">Đang tải...</div>
          <div v-else-if="sosList.length === 0" class="panel-empty">Chưa có yêu cầu SOS nào.</div>
          <div v-else-if="danhSachLoc.length === 0" class="panel-empty">Không có SOS khớp bộ lọc.</div>
          <ul v-else class="sos-list">
            <li
              v-for="sos in danhSachLoc"
              :key="sos.id"
              class="sos-item"
              :class="[
                `muc-${mucDoSos(sos.type)}`,
                {
                  active: sos.id === selectedSosId,
                  'sos-xong': laSosDaKetThuc(sos.status),
                  'sos-moi': laSosMoi(sos)
                }
              ]"
              tabindex="0"
              @click="openAssignModal(sos)"
              @keydown.enter="openAssignModal(sos)"
            >
              <div class="sos-item-top">
                <span class="sos-badge">{{ SOS_TYPE_LABEL[sos.type] }}</span>
                <span v-if="!laSosDaKetThuc(sos.status)" class="muc-tag" :class="`muc-tag--${mucDoSos(sos.type)}`">
                  {{ NHAN_MUC_DO[mucDoSos(sos.type)] }}
                </span>
                <span class="sos-status-badge" :class="`st-${sos.status}`">{{ SOS_STATUS_LABEL[sos.status] }}</span>
              </div>
              <div class="sos-victim">
                {{ sos.victim_name }} ·
                <a :href="`tel:${sos.victim_phone}`" class="sos-tel" @click.stop>{{ sos.victim_phone }}</a>
              </div>
              <div class="sos-dong">
                <span aria-hidden="true">📍</span>
                <span>
                  <template v-if="tenDuong(sos.lat, sos.lng)">{{ tenDuong(sos.lat, sos.lng) }}, </template>
                  {{ tenXa(sos.ward_code) }}
                </span>
              </div>
              <div class="sos-dong">
                <span aria-hidden="true">🕒</span>
                <span>{{ ngayGio(sos.created_at) }} · <b>{{ truocDo(sos.created_at) }}</b></span>
              </div>
              <p v-if="sos.location_estimated" class="sos-location-warn">⚠️ Vị trí ước tính</p>
            </li>
          </ul>
        </template>

        <template v-else-if="panelTab === 'hazards'">
          <div class="hazard-hint">
            Vòng tròn ĐỎ là vùng chặn đường — thuật toán tìm đường sẽ tự tránh. Vòng tròn VÀNG chỉ là
            cảnh báo cẩn trọng, không làm tuyến đi vòng. Bấm "+ Đánh dấu cảnh báo" ở trên rồi kéo
            ghim tới đúng chỗ và bấm "Xác nhận vị trí".
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
                Bán kính {{ h.radius_meters }}m · {{ tenXa(h.ward_code) }} · {{ formatTime(h.created_at) }}
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
          <h3>{{ coTheGiaoDoi ? 'Phân công đội cứu hộ' : 'Chi tiết yêu cầu SOS' }}</h3>
          <button class="modal-close" @click="closeModal">✕</button>
        </div>
        <p v-if="modalSos" class="modal-sub">
          {{ SOS_TYPE_LABEL[modalSos.type] }} — {{ modalSos.victim_name }} ({{ modalSos.victim_phone }})
        </p>
        <p v-if="modalSos" class="modal-vi-tri">
          📍 <template v-if="tenDuong(modalSos.lat, modalSos.lng)">{{ tenDuong(modalSos.lat, modalSos.lng) }}, </template>
          {{ tenXa(modalSos.ward_code) }}<br />
          🕒 {{ ngayGio(modalSos.created_at) }} ({{ truocDo(modalSos.created_at) }})
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

    <!-- Modal tạo cảnh báo -->
    <div v-if="hazardFormOpen" class="modal-overlay open" @click.self="closeHazardForm">
      <div class="modal-card">
        <div class="modal-head">
          <h3>Thêm cảnh báo/chặn đường</h3>
          <button class="modal-close" @click="closeHazardForm">✕</button>
        </div>
        <p class="modal-sub">
          Vị trí:
          <template v-if="tenDuong(hazardFormLat, hazardFormLng)">{{ tenDuong(hazardFormLat, hazardFormLng) }} · </template>
          {{ hazardFormLat.toFixed(5) }}, {{ hazardFormLng.toFixed(5) }}
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
   lên header này: nó không chiếm chỗ, đè lên bản đồ/bảng thống kê và che mất nút. sticky (cùng
   cách RescuerView): chiếm chỗ bình thường trong cột flex 100vh của .dashboard-page; top: 0 để
   sticky có tác dụng thật. */
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
/* wrap: thêm 2 liên kết có nhãn nên header dài hơn — màn hẹp xuống dòng thay vì tràn ngang. */
.dashboard-top {
  flex-wrap: wrap;
  gap: 8px 16px;
}
@media (max-width: 480px) {
  .dashboard-top {
    padding: 10px 12px;
  }
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
  width: 44px;
  height: 44px;
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
  flex-wrap: wrap;
  align-items: center;
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
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  font-size: 14px;
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
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
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
   vẽ tràn khỏi khung 60%; trước đây có lúc bản đồ lấn sang đè lên bảng bên phải (lỗi vẽ Chrome).
   z-index: 0 tạo stacking context riêng (như .rescuer-map): pane Leaflet (z 400+) và
   .map-che-do (z 800) chỉ xếp lớp TRONG vùng bản đồ, không vẽ đè header. */
.dashboard-map {
  position: relative;
  z-index: 0;
  overflow: hidden;
  contain: paint;
  flex: 0 0 60%;
  max-width: 60%;
  height: 100%;
  position: relative;
  z-index: 0;
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
  /* 15px + nút/ô chọn cao 44px: thao tác chạm trên bản đồ, thường đang di chuyển/ngoài trời.
     Nút zoom Leaflet ở góc trên TRÁI nên hộp lớn hơn không che nó. */
  font-size: 15px;
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
  min-height: 44px;
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
  min-height: 44px;
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
  font-size: 13px;
}
.map-che-do__thang {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}
.map-che-do__mau {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: linear-gradient(90deg, #2c7bb6, #abd9e9, #fee090, #fdae61, #d7191c);
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
  font-size: 16px;
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
  color: rgba(42, 42, 36, 0.75);
  cursor: pointer;
}
.panel-tab.active {
  color: var(--pine-deep);
  border-bottom-color: var(--pine-deep);
}
.panel-empty {
  padding: 24px 20px;
  color: rgba(42, 42, 36, 0.75);
  font-size: 14px;
}

.btn-placing {
  border-color: #b91c1c;
  color: #b91c1c;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 13px;
  margin-top: 8px;
}

.hazard-hint {
  padding: 12px 20px;
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
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
  font-size: 13px;
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
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
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
/* Viền trái + nền nhạt theo MỨC ĐỘ (constants/sosMucDo.ts) — ca nguy kịch nổi lên ngay khi lướt
   danh sách. Trạng thái nằm ở chữ góc phải. Mọi chữ trên nền thẻ ≥ 4.5:1 (tuongPhanChu.spec.ts). */
.sos-item {
  border-left-width: 6px;
}
.sos-item.muc-nguy-kich {
  border-left-color: #b91c1c;
  background: #fff5f5;
}
.sos-item.muc-nang {
  border-left-color: #ea580c;
  background: #fffaf3;
}
.sos-item.muc-vua {
  border-left-color: #ca8a04;
}
.sos-item.muc-nhe {
  border-left-color: #64748b;
}
.sos-item.sos-xong {
  border-left-color: #9ca3af;
  background: #ffffff;
}
.sos-item:hover,
.sos-item.active {
  background: var(--fog-dim);
}
.sos-item:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: -3px;
}
/* SOS mới chưa ai nhận: viền ngoài nhấp nháy tới khi có đội hoặc quá 5 phút. */
.sos-item.sos-moi {
  animation: sos-moi 1.4s ease-in-out infinite;
}
@keyframes sos-moi {
  0%,
  100% {
    box-shadow: inset 0 0 0 0 rgba(185, 28, 28, 0);
  }
  50% {
    box-shadow: inset 0 0 0 3px rgba(185, 28, 28, 0.55);
  }
}
@media (prefers-reduced-motion: reduce) {
  .sos-item.sos-moi {
    animation: none;
    box-shadow: inset 0 0 0 3px rgba(185, 28, 28, 0.55);
  }
}
.muc-tag {
  margin-right: auto;
  margin-left: 8px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
}
.muc-tag--nguy-kich {
  background: #fee2e2;
  color: #991b1b;
}
.muc-tag--nang {
  background: #ffedd5;
  color: #9a3412;
}
.muc-tag--vua {
  background: #fef9c3;
  color: #854d0e;
}
.muc-tag--nhe {
  background: #f1f5f9;
  color: #334155;
}
.sos-status-badge.st-pending {
  color: #991b1b;
  font-weight: 700;
}
.sos-status-badge.st-assigned,
.sos-status-badge.st-in_progress,
.sos-status-badge.st-arrived {
  color: #1e40af;
  font-weight: 600;
}
.sos-status-badge.st-resolved {
  color: #166534;
}
.sos-dong {
  display: flex;
  gap: 6px;
  margin-top: 3px;
  font-size: 14px;
  color: #3f3f38;
}
.sos-dong b {
  color: #2a2a24;
}
.sos-tel {
  color: #1e40af;
  font-weight: 600;
  text-decoration: underline;
}

.sos-item-top {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.sos-badge {
  font-size: 13px;
  font-weight: 600;
  color: var(--pine-deep);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sos-status-badge {
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
}
.sos-victim {
  font-size: 15px;
  font-weight: 500;
  margin-bottom: 2px;
}
.sos-location-warn {
  font-size: 13px;
  color: #b45309;
  background: #fef3c7;
  border-radius: 6px;
  padding: 4px 8px;
  margin: 4px 0;
  display: inline-block;
}
.sos-meta {
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
}

.modal-sub {
  font-size: 14px;
  color: rgba(42, 42, 36, 0.75);
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
  font-size: 15px;
}
.team-meta {
  display: block;
  font-size: 13px;
  color: rgba(42, 42, 36, 0.75);
  margin-top: 2px;
}

.panel-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.dash-export { border: 1px solid var(--line); background: transparent; color: var(--ink); border-radius: 8px; padding: 6px 12px; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
.dash-export:hover:not(:disabled) { border-color: var(--ink); }
.dash-export:disabled { opacity: 0.45; cursor: not-allowed; }
/* Cùng lề 20px với .panel-head và .sos-item — trước đây padding 0 (bộ lọc) / 4px (thống kê) nên
   ô tìm kiếm, 2 ô chọn và biểu đồ dính sát 2 mép khung, "Xoá lọc" như bị cắt ở mép phải. */
.dash-filters { display: flex; flex-direction: column; gap: 8px; padding: 12px 20px; border-bottom: 1px solid var(--line); }
.dash-search { width: 100%; padding: 8px 12px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; font-family: inherit; background: var(--fog); color: var(--ink); }
.dash-selects { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.dash-selects select { flex: 1; min-width: 120px; min-height: 36px; padding: 7px 10px; border: 1px solid var(--line); border-radius: 8px; font-size: 14px; font-family: inherit; background: var(--fog); color: var(--ink); cursor: pointer; }
.dash-clear { border: none; background: none; color: var(--clay); font-size: 14px; cursor: pointer; white-space: nowrap; }
.dash-clear:hover { text-decoration: underline; }

.dash-stats { padding: 14px 20px 12px; border-bottom: 1px solid var(--line); }
.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(74px, 1fr)); gap: 8px; margin-bottom: 14px; }
.stat-card { display: flex; flex-direction: column; gap: 2px; padding: 8px 10px; border-radius: 10px; background: var(--fog); border: 1px solid var(--line); }
.stat-num { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; line-height: 1; color: var(--pine-deep); }
.stat-lbl { font-size: 13px; color: rgba(42,42,36,0.75); } /* 0.6 chỉ đạt 3.8:1 trên --fog */
.stat-total { background: var(--pine-deep); border-color: var(--pine-deep); }
.stat-total .stat-num { color: var(--fog); }
.stat-total .stat-lbl { color: rgba(245,241,230,0.7); }
/* Màu trạng thái gốc (cam #d99a35, xanh #2f7d4f) chỉ đạt 2.16 và 4.47:1 trên --fog → không dùng
   cho CHỮ. Giữ màu gốc ở viền trái để nhận diện trạng thái, chữ số dùng sắc đậm cùng tông:
   #8a5a12 ≈ 5.2:1, #2a6e45 ≈ 5.5:1 (khoá bằng tuongPhanChu.spec.ts). Không dựa vào ngưỡng 3:1
   "chữ lớn": 22px chưa tới 24px, còn font-weight 600 chưa chắc tính là đậm theo WCAG. */
.sc-pending { border-left: 4px solid var(--clay); }
.sc-in_progress { border-left: 4px solid #d99a35; }
.sc-resolved { border-left: 4px solid #2f7d4f; }
.sc-pending .stat-num { color: var(--clay); }
.sc-in_progress .stat-num { color: #8a5a12; }
.sc-resolved .stat-num { color: #2a6e45; }
.stat-bars-title { font-size: 13px; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
.stat-bar-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.stat-bar-lbl { flex: 0 0 84px; font-size: 13px; color: rgba(42,42,36,0.7); }
.stat-bar-track { flex: 1; height: 8px; border-radius: 5px; background: var(--line); overflow: hidden; }
.stat-bar-fill { display: block; height: 100%; border-radius: 5px; background: var(--clay); transition: width 0.3s ease; }
.stat-bar-val { flex: 0 0 24px; text-align: right; font-size: 13px; font-weight: 600; color: var(--ink); }

/* KHÔNG có luật dark riêng cho khu thống kê: .dashboard-panel luôn nền trắng (trang giữ nền
   sáng ở dark mode, xem style.css), luật cũ ép chữ kem sáng → ~1.0–1.2:1, gần như vô hình.
   Khoá bằng tuongPhanChu.spec.ts. */

/* Bảng xếp hạng SOS theo xã — nổi góc phải trên bản đồ, dưới nút Điểm SOS/Mật độ. */
.thong-ke-xa {
  position: absolute;
  top: 76px;
  right: 12px;
  z-index: 800;
  width: min(280px, calc(100% - 24px));
  max-height: calc(100% - 100px);
  display: flex;
  flex-direction: column;
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  color: #2a2a24;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.2);
}
.thong-ke-xa__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.thong-ke-xa__head h2 {
  margin: 0;
  font-size: 15px;
  color: #2a2a24;
}
.thong-ke-xa__dong {
  min-width: 40px;
  min-height: 40px;
  border: none;
  background: none;
  color: #2a2a24;
  font-size: 16px;
  cursor: pointer;
}
.thong-ke-xa__khoang {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 8px;
  font-size: 14px;
  color: #3f3f38;
}
.thong-ke-xa__khoang select {
  min-height: 36px;
  padding: 0 6px;
  border: 1px solid rgba(42, 42, 36, 0.35);
  border-radius: 8px;
  background: #ffffff;
  color: #2a2a24;
  font: inherit;
}
.thong-ke-xa__trong,
.thong-ke-xa__tong {
  margin: 0 0 6px;
  font-size: 14px;
  color: #3f3f38;
}
.thong-ke-xa__ds {
  list-style: none;
  margin: 0;
  padding: 0;
  overflow-y: auto;
}
.thong-ke-xa__ds button {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-height: 38px;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: #2a2a24;
  font: inherit;
  font-size: 14px;
  text-align: left;
  cursor: pointer;
}
.thong-ke-xa__ds button:hover {
  background: #f1ede2;
}
.thong-ke-xa__ds b {
  color: #8a3a20;
}

/* Dải báo "có báo cáo mới chờ duyệt" — nền vàng đậm chữ nâu (≥ 4.5:1). */
.bao-cao-moi-bar {
  display: block;
  width: 100%;
  min-height: 44px;
  padding: 10px 20px;
  border: none;
  border-bottom: 2px solid #d97706;
  background: #fef3c7;
  color: #78350f;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
}
.bao-cao-moi-bar:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: -3px;
}
/* Số ca nguy kịch/nặng đang mở, trên tab SOS. */
.tab-gap {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: #b91c1c;
  color: #ffffff;
  font-size: 13px;
  font-weight: 700;
}
.dash-xa {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #1e3a8a;
}
.modal-vi-tri {
  margin: -10px 0 14px;
  font-size: 14px;
  line-height: 1.6;
  color: #3f3f38;
}
/* Bảng chọn vị trí cảnh báo — nổi ở đáy bản đồ, trên các pane Leaflet (z ≤ 700) và dưới modal. */
.dat-ghim {
  position: absolute;
  left: 50%;
  bottom: 16px;
  z-index: 900;
  transform: translateX(-50%);
  width: min(420px, calc(100% - 32px));
  padding: 12px 14px;
  border-radius: 12px;
  background: #ffffff;
  color: #2a2a24;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.25);
  border-top: 4px solid #1d4ed8;
}
.dat-ghim__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dat-ghim__head h2 {
  margin: 0;
  font-size: 16px;
  color: #2a2a24;
}
.dat-ghim__dong {
  min-width: 44px;
  min-height: 44px;
  border: none;
  background: none;
  color: #2a2a24;
  font-size: 18px;
  cursor: pointer;
}
.dat-ghim__huong-dan {
  margin: 4px 0 8px;
  font-size: 14px;
  color: #3f3f38;
}
.dat-ghim__dia-chi {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 600;
  color: #2a2a24;
}
.dat-ghim__toa-do {
  display: block;
  font-weight: 400;
  font-size: 13px;
  color: #4b4b44;
}
.dat-ghim__nut {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.dat-ghim__nut .btn-ghost {
  color: #2a2a24;
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
  /* Lấp phần còn lại thay vì cứng 55vh: header giờ chiếm chỗ (sticky), 45vh + 55vh + header
     sẽ tràn quá 100vh của .dashboard-page. Danh sách vẫn tự cuộn bên trong (overflow-y). */
  .dashboard-panel {
    flex: 1;
    min-height: 0;
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
  color: rgba(42, 42, 36, 0.75);
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
  font-size: 14px;
  white-space: pre-wrap;
}
</style>