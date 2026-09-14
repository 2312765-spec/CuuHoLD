<script setup lang="ts">
// Bản đồ Leaflet cho DashboardView (commander) và RescuerView (rescuer) — vẽ marker SOS
// (màu theo status), marker đội cứu hộ, và (tuỳ chọn) đường từ vị trí rescuer tới nạn nhân.
// Tách riêng khỏi useLeafletMap vì composable đó gắn với dữ liệu minh hoạ
// (DiemCuuTro/BaoCaoSuCo) + lớp ranh giới, còn ở đây chỉ cần marker SOS thật.

import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SosListItem, RescueTeam, NearestTeam, SosStatus } from '@/types'
import type { ToaDo } from '@/utils/geo'
import { taoLopTileNen } from '@/utils/tileLayer'

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
  // Vẽ nét đứt để không bị đọc nhầm thành đường đi thật; chỉ đường thật do Google Maps lo.
  route?: { from: ToaDo; to: ToaDo } | null
}>()

const emit = defineEmits<{ 'select-sos': [id: string]; 'tile-error': [loi: boolean] }>()

const STATUS_COLOR: Record<SosStatus, string> = {
  pending: '#dc2626',
  assigned: '#f97316',
  in_progress: '#eab308',
  arrived: '#3b82f6',
  resolved: '#16a34a',
  cancelled: '#9ca3af',
  false_alarm: '#9ca3af'
}

const mapContainer = ref<HTMLDivElement | null>(null)
let map: L.Map | null = null
let sosLayer: L.LayerGroup | null = null
let teamLayer: L.LayerGroup | null = null
let routeLayer: L.LayerGroup | null = null

// true khi tile nền OSM đang lỗi. Chỉ emit lúc giá trị THỰC SỰ đổi (watch trên ref, không
// gọi emit thẳng trong .on('tileerror', ...)) — nhiều tile lỗi liên tiếp không tạo nhiều
// emit, tránh DashboardView.vue hiện lặp lại cùng 1 toast cho từng tile.
const loiTile = ref(false)
watch(loiTile, (loi) => emit('tile-error', loi))

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
    marker.bindTooltip(`${sos.victim_name ?? ''} — ${sos.type} (${sos.status})`, { direction: 'top' })
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
    marker.bindTooltip(`${team.name} (${team.status})`, { direction: 'top' })
    marker.addTo(teamLayer)
  }
}

function buildRouteLayer() {
  if (!routeLayer) return
  routeLayer.clearLayers()
  const r = props.route
  if (!r) return
  L.polyline(
    [
      [r.from.lat, r.from.lng],
      [r.to.lat, r.to.lng]
    ],
    { color: '#1f3d2e', weight: 3, dashArray: '6 8' }
  ).addTo(routeLayer)
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
  taoLopTileNen()
    .on('tileerror', () => {
      loiTile.value = true
    })
    .on('tileload', () => {
      loiTile.value = false
    })
    .addTo(map)

  sosLayer = L.layerGroup().addTo(map)
  teamLayer = L.layerGroup().addTo(map)
  routeLayer = L.layerGroup().addTo(map)
  buildSosLayer()
  buildTeamLayer()
  buildRouteLayer()
  focusSelected()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  sosLayer = null
  teamLayer = null
  routeLayer = null
})

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
</script>

<template>
  <div ref="mapContainer" class="rescue-map"></div>
</template>

<style scoped>
.rescue-map {
  width: 100%;
  height: 100%;
}
</style>
