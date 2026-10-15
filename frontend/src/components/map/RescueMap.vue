<script setup lang="ts">
// Bản đồ Leaflet cho DashboardView (commander) và RescuerView (rescuer) — vẽ marker SOS
// (màu theo status), marker đội cứu hộ, và (tuỳ chọn) đường từ vị trí rescuer tới nạn nhân.
// Tách riêng khỏi useLeafletMap vì composable đó gắn với dữ liệu minh hoạ
// (DiemCuuTro/BaoCaoSuCo) + lớp ranh giới, còn ở đây chỉ cần marker SOS thật.

import { onMounted, onBeforeUnmount, ref, shallowRef, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import '@/utils/leafletPlugins'
import type {
  SosListItem,
  RescueTeam,
  NearestTeam,
  SosStatus,
  SosType,
  RouteResult,
  SosHeatmapPoint,
  Hazard,
  HazardType,
  HazardReportAdmin
} from '@/types'
import { dinhDangKhoangCach, type ToaDo } from '@/utils/geo'
import { taoLopTileNen } from '@/utils/tileLayer'
import { SOS_TYPE_LABEL, SOS_TYPE_ICON, SOS_STATUS_LABEL, RESCUE_TEAM_STATUS_LABEL } from '@/constants/sosLabels'

// Chỉ các field thật sự dùng để vẽ — nhận được cả SosListItem (GET /api/sos, commander)
// lẫn SosRequest (GET /api/sos/:id, rescuer — ở đó victim_name là optional).
type SosTrenBanDo = Pick<SosListItem, 'id' | 'type' | 'status' | 'lat' | 'lng'> & {
  victim_name?: string
}

const props = defineProps<{
  sosList: SosTrenBanDo[]
  teams: (RescueTeam | NearestTeam)[]
  selectedSosId?: string | null
  // Đường THẲNG (chim bay) từ vị trí rescuer tới nạn nhân — KHÔNG phải tuyến đường bộ.
  // Vẽ nét đứt để không bị đọc nhầm thành đường đi thật. CHỈ vẽ khi routeThat null/chưa có
  // (xem buildRouteLayer) — có route thật thì route thật ưu tiên hiển thị.
  route?: { from: ToaDo; to: ToaDo } | null
  // Tuyến đường bộ THẬT (OpenRouteService, CLAUDE.md Mục 15.13) — vẽ liền nét. null/undefined
  // khi thiếu ORS_API_KEY hoặc ORS lỗi/không tìm được tuyến; lúc đó `route` (chim bay) là
  // fallback duy nhất còn hiển thị.
  routeThat?: RouteResult | null
  // Thống kê SOS theo xã (GET /api/gis/sos-heatmap) — vòng tròn theo xã kèm số vụ, vẽ CHỒNG lên
  // marker. undefined/rỗng thì không vẽ gì (DashboardView chỉ truyền khi commander bật toggle
  // "Thống kê theo xã"). Khác `heatmap` bên dưới (chế độ bản đồ nhiệt, ẩn marker SOS).
  thongKeXa?: SosHeatmapPoint[]
  // Cảnh báo/chặn đường đang hoạt động (GET /api/hazards) — hiện cho MỌI vai trò xem bản đồ,
  // không chỉ commander (an toàn thực địa, xem hazardsService.ts).
  hazards?: Hazard[]
  // Báo cáo cộng đồng ĐANG CHỜ DUYỆT — chỉ commander truyền vào (vàng, nét đứt, chưa là cảnh báo thật
  // và chưa ảnh hưởng tuyến đường). Người dân/cứu hộ không bao giờ thấy các điểm này trên bản đồ chung.
  pendingReports?: HazardReportAdmin[]
  selectedReportId?: string | null
  // true khi commander đang ở chế độ "chọn điểm đặt cảnh báo" — click lên bản đồ sẽ emit
  // 'pick-location' thay vì các hành vi khác (không có select-sos nào bị ảnh hưởng, click vẫn
  // luôn nằm trên nền map, không phải trên marker).
  placingHazard?: boolean
  // F-MAP-05: gom cụm marker SOS — bật ở Dashboard (commander, có thể hàng trăm SOS), tắt ở
  // RescuerView (vài nhiệm vụ, gom cụm chỉ làm khó bấm).
  gomCum?: boolean
  // F-MAP-03: có giá trị (kể cả mảng rỗng) = đang ở chế độ bản đồ nhiệt → ẩn marker SOS,
  // chỉ vẽ lớp nhiệt. null/undefined = chế độ điểm SOS bình thường.
  heatmap?: [number, number, number][] | null
}>()

const emit = defineEmits<{
  'select-sos': [id: string]
  'tile-error': [loi: boolean]
  'pick-location': [lat: number, lng: number]
  'select-report': [id: string]
}>()

const HAZARD_LABEL: Record<HazardType, string> = {
  landslide: 'Sạt lở',
  fallen_tree: 'Cây đổ',
  flood: 'Ngập lụt',
  danger: 'Nguy hiểm',
  other: 'Cảnh báo khác'
}

const STATUS_COLOR: Record<SosStatus, string> = {
  pending: '#dc2626',
  assigned: '#f97316',
  in_progress: '#eab308',
  arrived: '#3b82f6',
  resolved: '#16a34a',
  cancelled: '#9ca3af',
  false_alarm: '#9ca3af'
}

const MAU_CANH_BAO = {
  do: { vien: '#b91c1c', nen: '#ef4444' },
  vang: { vien: '#a16207', nen: '#facc15' }
} as const

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let thongKeXaLayer: L.LayerGroup | null = null
let hazardLayer: L.LayerGroup | null = null
let reportLayer: L.LayerGroup | null = null
// Cho màn cha gắn thêm control lên chính bản đồ này (nút "Vị trí của tôi") mà không phải sửa
// RescueMap. shallowRef: không bọc đối tượng Leaflet trong proxy phản ứng.
const mapInstance = shallowRef<L.Map | null>(null)
defineExpose({ mapInstance })
// Là MarkerClusterGroup khi gomCum, LayerGroup thường khi không — cùng API addLayers/clearLayers.
let sosLayer: L.LayerGroup | null = null
let heatLayer: L.HeatLayer | null = null
let teamLayer: L.LayerGroup | null = null
let routeLayer: L.LayerGroup | null = null

// true khi tile nền OSM đang lỗi. Chỉ emit lúc giá trị THỰC SỰ đổi (watch trên ref) — nhưng
// giá trị đó phải được gán MỘT LẦN sau khi cả đợt tile (giữa 'loading' và 'load') đã xong,
// KHÔNG phải trong từng 'tileload'/'tileerror' riêng lẻ: hai event đó bắn cho TỪNG tile,
// xen kẽ không theo thứ tự khi nhiều tile tải song song, nên gán thẳng ref trong đó khiến
// nó bật/tắt liên tục trong CÙNG một lượt zoom — mỗi lần đổi là 1 toast xếp hàng ở
// DashboardView, tồn đọng phát tiếp nối nhau rất lâu sau khi mạng đã ổn định (bug thật đã
// gặp, xem git log). Xem giải thích đầy đủ ở useLeafletMap.ts (cùng lỗi, cùng cách sửa).
const loiTile = ref(false)
watch(loiTile, (loi) => emit('tile-error', loi))

// Vàng nhạt (ít vụ) → đỏ đậm (nhiều vụ) — nội suy tuyến tính theo tỉ lệ so với xã nhiều nhất
// trong khoảng thời gian đang xem, không phải theo mốc cố định (vì tổng số vụ mỗi tháng khác
// nhau nhiều, mốc cố định sẽ có tháng toàn đỏ hoặc toàn vàng).
function mauTheoMucDo(tyLe: number): string {
  const g = Math.round(210 - tyLe * 170)
  const b = Math.round(80 - tyLe * 60)
  return `rgb(250, ${Math.max(g, 0)}, ${Math.max(b, 0)})`
}

function buildThongKeXaLayer() {
  if (!thongKeXaLayer) return
  thongKeXaLayer.clearLayers()
  const points = props.thongKeXa ?? []
  if (points.length === 0) return
  const max = Math.max(...points.map((p) => p.incident_count))
  for (const p of points) {
    const tyLe = max > 0 ? p.incident_count / max : 0
    L.circleMarker([p.lat, p.lng], {
      radius: 12 + tyLe * 28,
      color: '#ffffff',
      weight: 1,
      fillColor: mauTheoMucDo(tyLe),
      fillOpacity: 0.55
    })
      .bindTooltip(`${p.ward_name}: ${p.incident_count} vụ`, { direction: 'top' })
      .addTo(thongKeXaLayer)
  }
}

// Vòng tròn bán kính thật (mét, L.circle — khác L.circleMarker dùng bán kính pixel) quanh mỗi
// cảnh báo, cùng bán kính PostGIS ST_Buffer() đã dùng để tính avoid_polygons cho ORS — vẽ
// đúng vùng thuật toán tìm đường THẬT SỰ đang tránh, không phải ước lượng riêng ở frontend.
function buildHazardLayer() {
  if (!hazardLayer) return
  hazardLayer.clearLayers()
  for (const h of props.hazards ?? []) {
    // ĐỎ = chặn đường (tuyến đi sẽ né), VÀNG = cẩn trọng (chỉ cảnh báo, không đổi tuyến).
    const dang = h.severity === 'caution' ? MAU_CANH_BAO.vang : MAU_CANH_BAO.do
    const nhan = `${h.severity === 'caution' ? 'Cẩn trọng' : 'Chặn đường'}: ${HAZARD_LABEL[h.type]}${
      h.description ? ' — ' + h.description : ''
    }`
    L.circle([h.lat, h.lng], {
      radius: h.radius_meters,
      color: dang.vien,
      weight: 2,
      dashArray: '4 6',
      fillColor: dang.nen,
      fillOpacity: 0.18
    })
      .bindTooltip(nhan, { direction: 'top' })
      .addTo(hazardLayer)
    // Biểu tượng ở tâm — vòng tròn bán kính mét thu rất nhỏ khi zoom xa nên cần 1 điểm nhấn cố định.
    L.marker([h.lat, h.lng], {
      icon: L.divIcon({
        className: 'hz-icon-wrap',
        html: `<span class="hz-icon hz-icon--${h.severity === 'caution' ? 'vang' : 'do'}">!</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      }),
      keyboard: false
    })
      .bindTooltip(nhan, { direction: 'top' })
      .addTo(hazardLayer)
  }
}

function buildReportLayer() {
  if (!reportLayer) return
  reportLayer.clearLayers()
  for (const r of props.pendingReports ?? []) {
    const chon = r.id === props.selectedReportId
    L.marker([r.lat, r.lng], {
      icon: L.divIcon({
        className: 'hz-icon-wrap',
        html: `<span class="hz-icon hz-icon--cho${chon ? ' hz-icon--chon' : ''}">?</span>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13]
      }),
      keyboard: false
    })
      .bindTooltip(`Chờ duyệt: ${HAZARD_LABEL[r.type]} — ${r.reporter_name}`, { direction: 'top' })
      .on('click', () => emit('select-report', r.id))
      .addTo(reportLayer)
  }
}

// Mức khẩn cấp để tô màu CỤM theo SOS gấp nhất bên trong: một SOS 'pending' nằm giữa 20 SOS
// đã xong vẫn làm cả cụm đỏ — gom cụm không được phép giấu ca chưa ai xử lý.
const MUC_KHAN_CAP: Record<SosStatus, number> = {
  pending: 6,
  assigned: 5,
  in_progress: 4,
  arrived: 3,
  resolved: 1,
  cancelled: 0,
  false_alarm: 0
}

// Marker SOS mang kèm id + trạng thái để icon cụm và hienSosTrongCum() đọc lại được.
type MarkerSos = L.Marker & { sosId: string; sosStatus: SosStatus }

// markercluster chỉ hỗ trợ L.Marker (nó gọi clusterHide/_setPos — CircleMarker không có, xòe
// cụm sẽ lỗi), nên marker SOS dùng divIcon hình tròn thay cho circleMarker, giữ nguyên màu/cỡ.
// SRS F-MAP-01 "custom icon theo loại SOS": biểu tượng = LOẠI sự cố, màu viền = TRẠNG THÁI
// (giữ quy ước màu cũ để commander không phải học lại).
function taoIconSos(status: SosStatus, type: SosType, dangChon: boolean): L.DivIcon {
  const d = dangChon ? 36 : 28
  return L.divIcon({
    className: 'sos-dot-icon',
    html: `<span class="sos-dot${dangChon ? ' sos-dot--chon' : ''}" data-loai="${type}" style="border-color:${STATUS_COLOR[status]}"><span aria-hidden="true">${SOS_TYPE_ICON[type]}</span></span>`,
    iconSize: [d, d]
  })
}

function taoIconCum(cum: L.MarkerCluster): L.DivIcon {
  const con = cum.getAllChildMarkers() as MarkerSos[]
  let gapNhat: SosStatus = 'false_alarm'
  let soChoXuLy = 0
  for (const m of con) {
    const st = m.sosStatus
    if (st === 'pending') soChoXuLy++
    if (MUC_KHAN_CAP[st] > MUC_KHAN_CAP[gapNhat]) gapNhat = st
  }
  const tong = cum.getChildCount()
  const d = tong < 10 ? 34 : tong < 50 ? 42 : 50
  const huyHieu = soChoXuLy > 0 ? `<span class="sos-cum__cho">${soChoXuLy}</span>` : ''
  const moTa = `${tong} SOS, gấp nhất: ${SOS_STATUS_LABEL[gapNhat]}${soChoXuLy ? `, ${soChoXuLy} chờ xử lý` : ''}`
  return L.divIcon({
    className: `sos-cum${gapNhat === 'pending' ? ' sos-cum--gap' : ''}`,
    html: `<span class="sos-cum__loi" style="background:${STATUS_COLOR[gapNhat]}" role="img" aria-label="${moTa}">${tong}</span>${huyHieu}`,
    iconSize: [d, d]
  })
}

function taoLopSos(): L.LayerGroup {
  if (!props.gomCum) return L.layerGroup()
  const giamChuyenDong = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  return L.markerClusterGroup({
    chunkedLoading: true,
    showCoverageOnHover: false,
    spiderfyOnMaxZoom: true,
    animate: !giamChuyenDong,
    // Từ zoom 15 (mức đường phố) hiện từng SOS riêng — commander cần thấy vị trí thật.
    disableClusteringAtZoom: 15,
    maxClusterRadius: (z: number) => (z <= 9 ? 70 : z <= 12 ? 50 : 35),
    iconCreateFunction: taoIconCum
  })
}

// Bảng id → marker đang vẽ, kèm "chữ ký" những gì ảnh hưởng tới hình dạng marker. Có bảng này
// mới biết marker nào thật sự đổi để chỉ đụng tới nó — trước đây mỗi lần danh sách SOS đổi
// (socket bắn liên tục ở Dashboard) là xoá SẠCH rồi dựng lại cả lớp + tính lại cụm, làm cụm
// commander đang mở bị đóng và tốn CPU tỉ lệ với TỔNG số SOS thay vì số SOS đổi.
const markerSosTheoId = new Map<string, { marker: MarkerSos; chuKy: string }>()

function chuKySos(sos: SosTrenBanDo, dangChon: boolean): string {
  return [sos.status, sos.type, sos.lat, sos.lng, sos.victim_name?.trim() ?? '', dangChon ? 1 : 0].join('|')
}

function taoMarkerSos(sos: SosTrenBanDo, isSelected: boolean): MarkerSos {
  const marker = L.marker([sos.lat, sos.lng], {
    icon: taoIconSos(sos.status, sos.type, isSelected),
    zIndexOffset: isSelected ? 1000 : 0,
    keyboard: true
  }) as MarkerSos
  marker.sosId = sos.id
  marker.sosStatus = sos.status
  // Tooltip dùng nhãn tiếng Việt, bỏ dấu gạch thừa khi thiếu tên nạn nhân, có class riêng
  // để canh chữ đẹp (không dính viền như tooltip mặc định Leaflet).
  const tenNan = sos.victim_name?.trim()
  const noiDung = `${tenNan ? tenNan + ' · ' : ''}${SOS_TYPE_LABEL[sos.type]} (${SOS_STATUS_LABEL[sos.status]})`
  marker.bindTooltip(noiDung, { direction: 'top', className: 'rescue-tooltip' })
  marker.on('click', () => emit('select-sos', sos.id))
  return marker
}

// Marker đổi trạng thái/loại/vị trí/đang-chọn thì THAY bằng marker mới (gỡ cũ + thêm mới) thay vì
// sửa tại chỗ: cụm (markercluster) chỉ tính lại màu/badge khi marker rời/vào cụm, nên cách này
// giữ icon cụm luôn đúng mà không phải gọi API refresh riêng của plugin.
function buildSosLayer() {
  if (!sosLayer) return
  const conTrongDs = new Set<string>()
  const canGo: L.Layer[] = []
  const canThem: L.Layer[] = []
  for (const sos of props.sosList) {
    conTrongDs.add(sos.id)
    const dangChon = sos.id === props.selectedSosId
    const chuKy = chuKySos(sos, dangChon)
    const cu = markerSosTheoId.get(sos.id)
    if (cu?.chuKy === chuKy) continue
    if (cu) canGo.push(cu.marker)
    const marker = taoMarkerSos(sos, dangChon)
    markerSosTheoId.set(sos.id, { marker, chuKy })
    canThem.push(marker)
  }
  for (const [id, { marker }] of markerSosTheoId) {
    if (conTrongDs.has(id)) continue
    canGo.push(marker)
    markerSosTheoId.delete(id)
  }
  // Gỡ trước, thêm sau — và theo lô: MarkerClusterGroup tính cụm 1 lần cho cả lô.
  if (canGo.length) {
    if (sosLayer instanceof L.MarkerClusterGroup) sosLayer.removeLayers(canGo as L.Marker[])
    else canGo.forEach((m) => sosLayer?.removeLayer(m))
  }
  if (canThem.length) {
    if (sosLayer instanceof L.MarkerClusterGroup) sosLayer.addLayers(canThem)
    else canThem.forEach((m) => m.addTo(sosLayer as L.LayerGroup))
  }
}

// F-MAP-03: chế độ bản đồ nhiệt thay cho marker SOS (không vẽ chồng cả hai — rối mắt).
const NGUONG_DO_TOI_THIEU = 5
function apDungCheDoHienThi() {
  if (!map || !sosLayer) return
  const dangXemNhiet = props.heatmap != null
  if (dangXemNhiet) {
    if (map.hasLayer(sosLayer)) map.removeLayer(sosLayer)
    if (!heatLayer) {
      heatLayer = L.heatLayer([], {
        radius: 25,
        blur: 18,
        maxZoom: 14,
        minOpacity: 0.35,
        gradient: { 0.2: '#2c7bb6', 0.45: '#abd9e9', 0.65: '#fee090', 0.8: '#fdae61', 1: '#d7191c' }
      })
    }
    const diem = props.heatmap ?? []
    // Ngưỡng tối thiểu 5: chỉ nơi có từ ~5 SOS dồn lại mới lên màu ĐỎ. Trước đây max = trọng số
    // lớn nhất (thường là 1 khi ít dữ liệu) → một SOS lẻ cũng hiện thành đốm đỏ rực như "điểm
    // nóng", dễ khiến commander hiểu nhầm là vùng có nhiều sự cố.
    const max = diem.reduce((m, p) => Math.max(m, p[2]), NGUONG_DO_TOI_THIEU)
    heatLayer.setOptions({ max })
    heatLayer.setLatLngs(diem)
    if (!map.hasLayer(heatLayer)) heatLayer.addTo(map)
  } else {
    if (heatLayer && map.hasLayer(heatLayer)) map.removeLayer(heatLayer)
    if (!map.hasLayer(sosLayer)) sosLayer.addTo(map)
  }
}

// Zoom tới 1 SOS kể cả khi nó đang nằm trong cụm (zoomToShowLayer tự mở cụm).
function hienSosTrongCum(id: string): boolean {
  if (!(sosLayer instanceof L.MarkerClusterGroup)) return false
  const m = (sosLayer.getLayers() as MarkerSos[]).find((l) => l.sosId === id)
  if (!m) return false
  sosLayer.zoomToShowLayer(m)
  return true
}

// Cùng ý với markerSosTheoId: mỗi đội gửi GPS 30 giây/lần nên trước đây cứ mỗi lần là xoá sạch
// + dựng lại MỌI marker đội. Giờ chỉ đội nào đổi chữ ký (vị trí, trạng thái, tên, khoảng cách/ETA)
// mới bị dựng lại; marker circleMarker nhẹ nên gỡ/thêm từng cái, không cần theo lô như cụm SOS.
const markerDoiTheoId = new Map<string, { marker: L.CircleMarker; chuKy: string }>()

function chuKyDoi(team: RescueTeam | NearestTeam): string {
  const khoangCach = 'distanceToVictim' in team ? team.distanceToVictim : null
  const eta = 'estimatedArrival' in team ? team.estimatedArrival : null
  return [team.name, team.status, team.lat, team.lng, khoangCach ?? '', eta ?? ''].join('|')
}

function taoMarkerDoi(team: RescueTeam | NearestTeam, lat: number, lng: number): L.CircleMarker {
  const marker = L.circleMarker([lat, lng], {
    radius: 7,
    color: '#1e3a8a',
    weight: 2,
    fillColor: team.status === 'available' ? '#2563eb' : '#94a3b8',
    fillOpacity: 0.9
  })
  let tooltip = `${team.name} (${RESCUE_TEAM_STATUS_LABEL[team.status]})`
  if ('distanceToVictim' in team && team.distanceToVictim != null && team.estimatedArrival != null) {
    tooltip += ` — cách nạn nhân ~${dinhDangKhoangCach(team.distanceToVictim)} · ETA ~${team.estimatedArrival} phút`
  }
  marker.bindTooltip(tooltip, { direction: 'top', className: 'rescue-tooltip' })
  return marker
}

function buildTeamLayer() {
  if (!teamLayer) return
  const conTrongDs = new Set<string>()
  for (const team of props.teams) {
    if (team.lat == null || team.lng == null) continue
    conTrongDs.add(team.id)
    const chuKy = chuKyDoi(team)
    const cu = markerDoiTheoId.get(team.id)
    if (cu?.chuKy === chuKy) continue
    if (cu) teamLayer.removeLayer(cu.marker)
    const marker = taoMarkerDoi(team, team.lat, team.lng)
    marker.addTo(teamLayer)
    markerDoiTheoId.set(team.id, { marker, chuKy })
  }
  // Đội bị loại khỏi danh sách (hoặc mất toạ độ) thì gỡ marker, đừng để bóng ma trên bản đồ.
  for (const [id, { marker }] of markerDoiTheoId) {
    if (conTrongDs.has(id)) continue
    teamLayer.removeLayer(marker)
    markerDoiTheoId.delete(id)
  }
}

// Tuyến gợi ý (ORS alternative_routes, share_factor:0.9) có thể trùng TỚI 90% chiều dài với
// tuyến chính — chỉ khác nhau 1 đoạn ngắn. Lấy điểm giữa MẢNG toạ độ (theo index) rất dễ rơi
// đúng vào đoạn trùng, khiến nhãn trông như đè lên tuyến chính. Hàm này tìm điểm trên tuyến
// phụ CÁCH XA tuyến chính nhất — chắc chắn nằm ở đúng đoạn 2 tuyến thật sự khác nhau.
function diemLechXaNhat(
  tuyenPhu: [number, number][],
  tuyenChinh: [number, number][]
): [number, number] {
  let diemXaNhat = tuyenPhu[Math.floor(tuyenPhu.length / 2)]
  let khoangCachXaNhat = -1
  for (const p of tuyenPhu) {
    let khoangCachGanNhat = Infinity
    for (const q of tuyenChinh) {
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2
      if (d < khoangCachGanNhat) khoangCachGanNhat = d
    }
    if (khoangCachGanNhat > khoangCachXaNhat) {
      khoangCachXaNhat = khoangCachGanNhat
      diemXaNhat = p
    }
  }
  return diemXaNhat
}

function buildRouteLayer() {
  if (!routeLayer) return
  routeLayer.clearLayers()
  const r = props.route
  if (!r) return

  // Có route thật (OpenRouteService) → vẽ liền nét theo đúng hình dạng đường bộ. Không có →
  // lùi về đường chim bay nét đứt như trước (thiếu ORS_API_KEY, ORS lỗi/mất mạng...).
  if (props.routeThat) {
    const rt = props.routeThat
    // Tuyến gợi ý — vẽ TRƯỚC (dưới) tuyến chính, màu xanh nhạt hơn hẳn để không lấn át tuyến
    // đang chọn. Nhãn ghi rõ dài/ngắn hơn bao nhiêu km.
    if (rt.alternate_geometry && rt.alternate_distance_meters != null) {
      const chenhKm = (rt.alternate_distance_meters - rt.distance_meters) / 1000
      const nhan =
        chenhKm >= 0
          ? `Tuyến khác: dài hơn ${chenhKm.toFixed(1)} km`
          : `Tuyến khác: ngắn hơn ${Math.abs(chenhKm).toFixed(1)} km`
      // ORS alternative_routes (share_factor:0.9) cho phép tới 90% chiều dài 2 tuyến TRÙNG
      // NHAU — điểm giữa mảng toạ độ rất dễ rơi đúng vào đoạn trùng đó, khiến nhãn trông như
      // đè lên tuyến chính. Dùng diemLechXaNhat() tìm đúng điểm tuyến phụ lệch xa tuyến chính
      // nhất rồi ép tooltip mở tại đó bằng openTooltip() — chắc chắn nằm ở đoạn 2 tuyến khác nhau.
      const diemLech = diemLechXaNhat(rt.alternate_geometry, rt.geometry)
      L.polyline(rt.alternate_geometry, { color: '#93c5fd', weight: 4, opacity: 0.85 })
        .bindTooltip(nhan, { permanent: true, direction: 'top' })
        .addTo(routeLayer)
        .openTooltip(diemLech)
    }
    // Xanh dương — khớp màu marker đội cứu hộ (#2563eb) đã dùng sẵn, cũng là quy ước màu
    // route phổ biến ở các app dẫn đường (Grab, Google Maps).
    L.polyline(rt.geometry, { color: '#2563eb', weight: 4 }).addTo(routeLayer)
  } else {
    L.polyline(
      [
        [r.from.lat, r.from.lng],
        [r.to.lat, r.to.lng]
      ],
      { color: '#1f3d2e', weight: 3, dashArray: '6 8' }
    ).addTo(routeLayer)
  }

  L.circleMarker([r.from.lat, r.from.lng], {
    radius: 7,
    color: '#ffffff',
    weight: 2,
    fillColor: '#2563eb',
    fillOpacity: 1
  })
    .bindTooltip('Vị trí của bạn', { direction: 'top' })
    .addTo(routeLayer)
}

// Đưa khung nhìn tới SOS đang chọn: có route thì ôm trọn cả 2 đầu, không thì zoom tới SOS.
function focusSelected() {
  if (!map) return
  const r = props.route
  if (r) {
    map.fitBounds(
      [
        [r.from.lat, r.from.lng],
        [r.to.lat, r.to.lng]
      ],
      { padding: [40, 40], maxZoom: 15 }
    )
    return
  }
  const id = props.selectedSosId
  if (id && props.heatmap == null && hienSosTrongCum(id)) return
  const sos = props.sosList.find((s) => s.id === id)
  if (sos) map.setView([sos.lat, sos.lng], Math.max(map.getZoom(), 13))
}

onMounted(() => {
  if (!mapContainer.value) return
  // preferCanvas: marker đội + đường đi (circleMarker/polyline) vẽ trên 1 canvas thay vì
  // mỗi cái 1 phần tử SVG — nhẹ hơn rõ trên điện thoại yếu. Marker SOS là divIcon (DOM) vì
  // markercluster cần L.Marker, nhưng gom cụm đã giữ số phần tử DOM ở mức nhỏ.
  // zoomControl: nút +/− — GIỮ (SRS mục 3.3 "Zoom in/out").
  map = L.map(mapContainer.value, { zoomControl: true, preferCanvas: true }).setView([11.9465, 108.4419], 9)
  // Cấu hình tile (URL, attribution, crossOrigin, ưu tiên bộ offline z8–10) nằm trong
  // utils/tileLayer.ts — dùng chung với useLeafletMap.ts, xem giải thích đầy đủ ở đó.
  let coLoiTrongDot = false
  taoLopTileNen()
    .on('loading', () => {
      coLoiTrongDot = false
    })
    .on('tileerror', () => {
      coLoiTrongDot = true
    })
    .on('load', () => {
      loiTile.value = coLoiTrongDot
    })
    .addTo(map)

  // Thêm thongKeXaLayer/hazardLayer TRƯỚC sosLayer/teamLayer — thứ tự add quyết định thứ tự vẽ
  // (layer thêm sau nằm trên), vòng tròn to/mờ phải nằm DƯỚI marker SOS/đội để không che mất
  // chúng.
  thongKeXaLayer = L.layerGroup().addTo(map)
  hazardLayer = L.layerGroup().addTo(map)
  reportLayer = L.layerGroup().addTo(map)
  sosLayer = taoLopSos().addTo(map)
  teamLayer = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  buildThongKeXaLayer()
  buildHazardLayer()
  buildReportLayer()
  buildSosLayer()
  apDungCheDoHienThi()
  buildTeamLayer()
  buildRouteLayer()
  focusSelected()

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (props.placingHazard) emit('pick-location', e.latlng.lat, e.latlng.lng)
  })
  mapInstance.value = map
})

onBeforeUnmount(() => {
  mapInstance.value = null
  map?.remove()
  map = null
  thongKeXaLayer = null
  hazardLayer = null
  reportLayer = null
  sosLayer = null
  markerSosTheoId.clear()
  markerDoiTheoId.clear()
  heatLayer = null
  teamLayer = null
  routeLayer = null
})

watch(() => props.thongKeXa, buildThongKeXaLayer, { deep: true })
watch(() => props.hazards, buildHazardLayer, { deep: true })
watch(() => [props.pendingReports, props.selectedReportId], buildReportLayer, { deep: true })
watch(() => props.sosList, buildSosLayer, { deep: true })
watch(() => props.teams, buildTeamLayer, { deep: true })
watch(() => props.heatmap, apDungCheDoHienThi)
watch(
  () => props.selectedSosId,
  (id) => {
    buildSosLayer()
    if (id) focusSelected()
  }
)
// Chỉ căn lại khung nhìn khi route vừa XUẤT HIỆN (GPS có fix đầu tiên). Các lần GPS cập nhật
// sau (vài giây một lần) chỉ vẽ lại đường — căn lại mỗi lần sẽ giật khung nhìn khỏi chỗ
// rescuer đang tự kéo/zoom xem.
watch(
  () => props.route,
  (moi, cu) => {
    buildRouteLayer()
    if (moi && !cu) focusSelected()
  }
)
// Route thật tải xong SAU route chim bay (bất đồng bộ, tuỳ ORS) — chỉ cần vẽ lại,
// không focusSelected() lại (khung nhìn đã đúng từ lúc route chim bay xuất hiện, tránh giật).
watch(() => props.routeThat, buildRouteLayer)
</script>

<template>
  <div ref="mapContainer" class="rescue-map" :class="{ 'placing-hazard': placingHazard }"></div>
</template>

<style scoped>
.rescue-map {
  width: 100%;
  height: 100%;
}
.rescue-map.placing-hazard :deep(.leaflet-container) {
  cursor: crosshair;
}
/* Biểu tượng cảnh báo (divIcon nằm trong DOM Leaflet nên cần :deep): đỏ = chặn đường, vàng = cẩn
   trọng, vàng nét đứt "?" = báo cáo cộng đồng đang chờ duyệt. */
.rescue-map :deep(.hz-icon-wrap) {
  background: transparent;
  border: 0;
}
.rescue-map :deep(.hz-icon) {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  font: 700 15px/1 system-ui, sans-serif;
  color: #fff;
}
.rescue-map :deep(.hz-icon--do) {
  background: #dc2626;
}
.rescue-map :deep(.hz-icon--vang) {
  background: #eab308;
  color: #422006;
}
.rescue-map :deep(.hz-icon--cho) {
  background: #fef08a;
  color: #713f12;
  border: 2px dashed #a16207;
}
.rescue-map :deep(.hz-icon--chon) {
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.55);
}
</style>

<style>
/* Marker SOS + cụm (F-MAP-05). Không scoped vì Leaflet tự tạo phần tử ngoài component. */
.sos-dot-icon {
  background: transparent;
  border: 0;
}
.sos-dot {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  /* Nền trắng để biểu tượng loại sự cố rõ trên mọi nền bản đồ; màu viền = trạng thái. */
  background: #ffffff;
  border: 3px solid;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
  box-sizing: border-box;
  font-size: 14px;
  line-height: 1;
}
.sos-dot--chon {
  border-width: 4px;
  font-size: 18px;
  /* Vòng ngoài tối để SOS đang chọn nổi bật (màu viền trong vẫn là trạng thái). */
  box-shadow: 0 0 0 3px #142720, 0 2px 6px rgba(0, 0, 0, 0.45);
}
.sos-cum {
  background: transparent;
}
.sos-cum__loi {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 3px solid #ffffff;
  box-sizing: border-box;
  color: #ffffff;
  font: 600 13px/1 'Inter', sans-serif;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}
.sos-cum__cho {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 20px;
  height: 20px;
  padding: 0 5px;
  border-radius: 10px;
  background: #dc2626;
  color: #ffffff;
  border: 2px solid #ffffff;
  box-sizing: border-box;
  font: 600 11px/16px 'Inter', sans-serif;
  text-align: center;
}
/* Cụm còn SOS chưa ai nhận: vòng lan toả để commander chú ý. */
.sos-cum--gap .sos-cum__loi {
  animation: sos-cum-lan 1.6s ease-out infinite;
}
@keyframes sos-cum-lan {
  0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.6); }
  100% { box-shadow: 0 0 0 14px rgba(220, 38, 38, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .sos-cum--gap .sos-cum__loi { animation: none; }
}
</style>
