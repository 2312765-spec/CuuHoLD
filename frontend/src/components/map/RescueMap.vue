<script setup lang="ts">
// Bản đồ Leaflet cho DashboardView (commander) và RescuerView (rescuer) — vẽ marker SOS
// (màu theo status), marker đội cứu hộ, và (tuỳ chọn) đường từ vị trí rescuer tới nạn nhân.
// Tách riêng khỏi useLeafletMap vì composable đó gắn với dữ liệu minh hoạ
// (DiemCuuTro/BaoCaoSuCo) + lớp ranh giới, còn ở đây chỉ cần marker SOS thật.

import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type {
  SosListItem,
  RescueTeam,
  NearestTeam,
  SosStatus,
  RouteResult,
  SosHeatmapPoint,
  Hazard,
  HazardType,
  HazardReportAdmin
} from '@/types'
import { dinhDangKhoangCach, type ToaDo } from '@/utils/geo'
import { taoLopTileNen } from '@/utils/tileLayer'
import { SOS_TYPE_LABEL, SOS_STATUS_LABEL, RESCUE_TEAM_STATUS_LABEL } from '@/constants/sosLabels'


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
  // Thống kê SOS theo xã (GET /api/gis/sos-heatmap) — undefined/rỗng thì không vẽ gì (DashboardView
  // chỉ truyền khi commander bật toggle, xem "Thống kê theo xã").
  heatmap?: SosHeatmapPoint[]
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
let heatmapLayer: L.LayerGroup | null = null
let hazardLayer: L.LayerGroup | null = null
let reportLayer: L.LayerGroup | null = null
let sosLayer: L.LayerGroup | null = null
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

function buildHeatmapLayer() {
  if (!heatmapLayer) return
  heatmapLayer.clearLayers()
  const points = props.heatmap ?? []
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
      .addTo(heatmapLayer)
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

function buildSosLayer() {
  if (!sosLayer) return
  sosLayer.clearLayers()
  for (const sos of props.sosList) {
    const isSelected = sos.id === props.selectedSosId
    const marker = L.circleMarker([sos.lat, sos.lng], {
      radius: isSelected ? 12 : 8,
      color: isSelected ? '#142720' : '#ffffff',
      weight: isSelected ? 3 : 2,
      fillColor: STATUS_COLOR[sos.status],
      fillOpacity: 0.95
    })
    // Tooltip dùng nhãn tiếng Việt, bỏ dấu gạch thừa khi thiếu tên nạn nhân, có class riêng
    // để canh chữ đẹp (không dính viền như tooltip mặc định Leaflet).
    const tenNan = sos.victim_name?.trim()
    const noiDung = `${tenNan ? tenNan + ' · ' : ''}${SOS_TYPE_LABEL[sos.type]} (${SOS_STATUS_LABEL[sos.status]})`
    marker.bindTooltip(noiDung, { direction: 'top', className: 'rescue-tooltip' })
    marker.on('click', () => emit('select-sos', sos.id))
    marker.addTo(sosLayer)
  }
}

function buildTeamLayer() {
  if (!teamLayer) return
  teamLayer.clearLayers()
  for (const team of props.teams) {
    if (team.lat == null || team.lng == null) continue
    const marker = L.circleMarker([team.lat, team.lng], {
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
    marker.addTo(teamLayer)
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
  const sos = props.sosList.find((s) => s.id === props.selectedSosId)
  if (sos) map.setView([sos.lat, sos.lng], Math.max(map.getZoom(), 13))
}

onMounted(() => {
  if (!mapContainer.value) return
  map = L.map(mapContainer.value, { zoomControl: true }).setView([11.9465, 108.4419], 9)
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

  // Thêm heatmapLayer/hazardLayer TRƯỚC sosLayer/teamLayer — thứ tự add quyết định thứ tự vẽ
  // (layer thêm sau nằm trên), vòng tròn to/mờ phải nằm DƯỚI marker SOS/đội để không che mất
  // chúng.
  heatmapLayer = L.layerGroup().addTo(map)
  hazardLayer = L.layerGroup().addTo(map)
  reportLayer = L.layerGroup().addTo(map)
  sosLayer = L.layerGroup().addTo(map)
  teamLayer = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  buildHeatmapLayer()
  buildHazardLayer()
  buildReportLayer()
  buildSosLayer()
  buildTeamLayer()
  buildRouteLayer()
  focusSelected()

  map.on('click', (e: L.LeafletMouseEvent) => {
    if (props.placingHazard) emit('pick-location', e.latlng.lat, e.latlng.lng)
  })
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  heatmapLayer = null
  hazardLayer = null
  reportLayer = null
  sosLayer = null
  teamLayer = null
  routeLayer = null
})

watch(() => props.heatmap, buildHeatmapLayer, { deep: true })
watch(() => props.hazards, buildHazardLayer, { deep: true })
watch(() => [props.pendingReports, props.selectedReportId], buildReportLayer, { deep: true })
watch(() => props.sosList, buildSosLayer, { deep: true })
watch(() => props.teams, buildTeamLayer, { deep: true })
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
