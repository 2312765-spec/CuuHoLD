<script setup lang="ts">
// Bản đồ Leaflet cho DashboardView (commander) — vẽ marker SOS (màu theo status) và
// marker đội cứu hộ. Tách riêng khỏi useLeafletMap vì composable đó gắn với dữ liệu
// minh hoạ (DiemCuuTro/BaoCaoSuCo) + lớp ranh giới, còn ở đây chỉ cần marker SOS thật.

import { onMounted, onBeforeUnmount, ref, watch } from 'vue'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { SosListItem, RescueTeam, NearestTeam, SosStatus } from '@/types'
import { TILE_URL, TILE_ATTRIBUTION } from '@/constants/tileProvider'

const props = defineProps<{
  sosList: SosListItem[]
  teams: (RescueTeam | NearestTeam)[]
  selectedSosId?: string | null
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
    marker.bindTooltip(`${sos.victim_name} — ${sos.type} (${sos.status})`, { direction: 'top' })
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

onMounted(() => {
  if (!mapContainer.value) return
  map = L.map(mapContainer.value, { zoomControl: true }).setView([11.9465, 108.4419], 9)
  // crossOrigin: xem giải thích đầy đủ trong useLeafletMap.ts (cùng thay đổi, áp cho
  // đúng nguồn tile OSM). Đã kiểm chứng OSM hỗ trợ CORS trước khi bật cờ này.
  L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 18,
    crossOrigin: 'anonymous'
  })
    .on('tileerror', () => {
      loiTile.value = true
    })
    .on('tileload', () => {
      loiTile.value = false
    })
    .addTo(map)

  sosLayer = L.layerGroup().addTo(map)
  teamLayer = L.layerGroup().addTo(map)
  buildSosLayer()
  buildTeamLayer()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
  sosLayer = null
  teamLayer = null
})

watch(() => props.sosList, buildSosLayer, { deep: true })
watch(() => props.teams, buildTeamLayer, { deep: true })
watch(
  () => props.selectedSosId,
  (id) => {
    buildSosLayer()
    if (!id || !map) return
    const sos = props.sosList.find((s) => s.id === id)
    if (sos) map.setView([sos.lat, sos.lng], Math.max(map.getZoom(), 13))
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
