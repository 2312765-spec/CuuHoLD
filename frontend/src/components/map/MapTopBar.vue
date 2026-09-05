<script setup lang="ts">
import { useRoute } from 'vue-router'
import type { MapLayerKey, LayerTab } from '@/types'
import { useAuthStore } from '@/stores/auth.store'

defineEmits<{ openAuth: [] }>()

const route = useRoute()
const authStore = useAuthStore()

const tabs: LayerTab[] = [
  { key: 'ranh-gioi', label: 'Ranh giới' },
  { key: 'diem-cuutro', label: 'Điểm cứu trợ' },
  { key: 'bao-cao', label: 'Báo cáo sự cố' }
]

function isActive(key: MapLayerKey): boolean {
  const current = (route.query.layer as string) || 'ranh-gioi'
  return current === key
}
</script>

<template>
  <header class="map-top">
    <RouterLink to="/" class="map-back" aria-label="Về trang chủ">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M11 3L5 9L11 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <span class="brand">Bản Đồ Cứu Trợ Lâm Đồng</span>
    </RouterLink>
    <nav class="layer-tabs">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.key"
        :to="{ path: '/map', query: { layer: tab.key } }"
        :class="{ active: isActive(tab.key) }"
      >
        {{ tab.label }}
      </RouterLink>
    </nav>
    <div class="map-top-right">
      <template v-if="authStore.isLoggedIn">
        <span class="map-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost sos-btn" @click="authStore.logout()">Đăng xuất</button>
      </template>
      <button v-else class="btn btn-ghost sos-btn" @click="$emit('openAuth')">Đăng nhập</button>
    </div>
  </header>
</template>