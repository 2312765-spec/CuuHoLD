<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Nút chuyển sáng/tối (F-UI-05). Đặt trong AppHeader.vue. Gọn một nút, đổi icon + nhãn
// aria theo trạng thái để người dùng trình đọc màn hình vẫn biết nút làm gì.
const { theme, chuyenTheme } = useTheme()
const laToi = computed(() => theme.value === 'dark')
</script>

<template>
  <button
    class="theme-toggle"
    type="button"
    :aria-label="laToi ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
    :title="laToi ? 'Giao diện sáng' : 'Giao diện tối'"
    @click="chuyenTheme"
  >
    <span aria-hidden="true">{{ laToi ? '☀️' : '🌙' }}</span>
  </button>
</template>

<style scoped>
.theme-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.theme-toggle:hover {
  border-color: var(--ink);
  transform: translateY(-1px);
}
</style>