<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
  badge?: string
  showAction?: boolean
}>()

const emit = defineEmits<{ action: [] }>()

// Màu badge theo mức độ: Khẩn cấp → đỏ đất, còn lại (Cảnh báo) → cam.
function badgeClass(badge?: string): string {
  if (!badge) return ''
  return badge.toLowerCase().includes('khẩn') ? 'badge-danger' : 'badge-warn'
}
</script>

<template>
  <div class="marker-popup-card">
    <b class="popup-title">{{ title }}</b>
    <span v-if="subtitle" class="popup-subtitle">{{ subtitle }}</span>
    <span v-if="badge" class="popup-badge" :class="badgeClass(badge)">{{ badge }}</span>
    <button v-if="showAction" class="popup-action-btn" @click="emit('action')">
      Đánh dấu đã xử lý
    </button>
  </div>
</template>

<style scoped>
.marker-popup-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  min-width: 160px;
  padding: 2px;
  font-family: 'Inter', sans-serif;
}
.popup-title {
  font-family: 'Fraunces', serif;
  font-size: 15px;
  font-weight: 600;
  color: var(--pine-deep, #142720);
  line-height: 1.3;
}
.popup-subtitle {
  font-size: 12.5px;
  color: rgba(42, 42, 36, 0.65);
  line-height: 1.4;
}
.popup-badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  letter-spacing: 0.02em;
}
.badge-danger {
  background: rgba(168, 70, 43, 0.14);
  color: #a8462b;
}
.badge-warn {
  background: rgba(217, 154, 53, 0.18);
  color: #b07818;
}
.popup-action-btn {
  margin-top: 4px;
  padding: 7px 14px;
  border: none;
  border-radius: 8px;
  background: var(--pine-deep, #142720);
  color: #fff;
  font-family: 'Inter', sans-serif;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.popup-action-btn:hover {
  background: #1f3d2e;
}
</style>