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
        <!-- Rescuer/commander lỡ quay lại /map (nút back, bookmark...) cần đường về lại
             view làm việc của mình — trước đây chỉ có tên + đăng xuất, không có lối ra. -->
        <RouterLink v-if="authStore.role === 'rescuer'" to="/rescuer" class="btn btn-ghost sos-btn">Nhiệm vụ của tôi</RouterLink>
        <RouterLink v-else-if="authStore.role === 'commander'" to="/dashboard" class="btn btn-ghost sos-btn">Bảng điều phối</RouterLink>
        <span class="map-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost sos-btn" @click="authStore.logout()">Đăng xuất</button>
      </template>
      <button v-else class="btn btn-ghost sos-btn" @click="$emit('openAuth')">Đăng nhập</button>
    </div>
  </header>
</template>

<style scoped>
/* Ép thanh trên về MỘT hàng gọn, không rớt dòng (đè map-style.css qua scoped). Nhờ vậy
   chiều cao ổn định ~60px, không đè lên .map-stats (top:60px). Tab dài thì cuộn ngang. */
.map-top{ flex-wrap:nowrap; gap:12px; overflow:hidden; }
.map-back{ flex-shrink:0; }
.map-back .brand{ white-space:nowrap; }
.layer-tabs{ flex-wrap:nowrap; overflow-x:auto; scrollbar-width:none; -ms-overflow-style:none; }
.layer-tabs::-webkit-scrollbar{ display:none; }
.layer-tabs a{ white-space:nowrap; flex-shrink:0; }
.map-top-right{ display:flex; align-items:center; gap:8px; flex-shrink:0; }

/* Mobile: ẩn bớt phần dài (tên trang, tên user) để mọi thứ đủ chỗ trên một hàng. */
@media (max-width: 720px){
  .map-top{ gap:10px; padding:0 14px; height:54px; }
  .map-back .brand{ display:none; }
  .map-user{ display:none; }
  .layer-tabs a{ padding:6px 12px; font-size:12px; }
  .map-top-right .sos-btn{ padding:7px 12px; font-size:12px; }
}
</style>