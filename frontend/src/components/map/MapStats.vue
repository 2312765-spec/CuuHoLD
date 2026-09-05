<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useMapDataStore } from '@/stores/mapData'
import type { MapLayerKey } from '@/types'

// Trước đây component này nhận soDiem qua props từ MapView.vue (phải truyền tay).
// Giờ tự đọc thẳng từ Pinia store — MapView.vue không cần biết MapStats tồn tại
// hay cần dữ liệu gì nữa, giảm phụ thuộc giữa các component.
const route = useRoute()
const activeLayer = computed<MapLayerKey>(() => (route.query.layer as MapLayerKey) || 'ranh-gioi')

const store = useMapDataStore()
const soDiem = computed(() => store.soDiemTheoLop(activeLayer.value))
</script>

<template>
  <div class="map-stats">
    <span><b>{{ soDiem }}</b> điểm hiển thị</span>
    <span class="dot-sep">·</span>
    <span><b>124</b> xã, phường</span>
    <span class="dot-sep">·</span>
    <span class="stat-note">Dữ liệu điểm cứu trợ &amp; báo cáo hiện là dữ liệu minh hoạ cho đồ án, chưa nối với PostGIS thật.</span>
  </div>
</template>