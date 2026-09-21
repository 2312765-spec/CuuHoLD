<script setup lang="ts">
import { computed } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Cụm nút Giao diện & Tiếp cận (F-UI-05 + F-UI-06): sáng/tối, cỡ chữ, tương phản cao.
// Đặt trong AppHeader.vue. Mỗi nút đổi icon + nhãn aria theo trạng thái cho trình đọc màn hình.
const { theme, fontScale, contrast, chuyenTheme, chuyenCoChu, chuyenTuongPhan } = useTheme()

const laToi = computed(() => theme.value === 'dark')
const chuLon = computed(() => fontScale.value === 'large')
const tuongPhanCao = computed(() => contrast.value === 'high')
</script>

<template>
  <div class="a11y-toggles">
    <button
      class="tt-btn"
      type="button"
      :aria-label="laToi ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối'"
      :title="laToi ? 'Giao diện sáng' : 'Giao diện tối'"
      @click="chuyenTheme"
    >
      <span aria-hidden="true">{{ laToi ? '☀️' : '🌙' }}</span>
    </button>

    <button
      class="tt-btn tt-font"
      type="button"
      :class="{ active: chuLon }"
      :aria-pressed="chuLon"
      :aria-label="chuLon ? 'Cỡ chữ thường' : 'Cỡ chữ lớn'"
      :title="chuLon ? 'Cỡ chữ thường' : 'Cỡ chữ lớn'"
      @click="chuyenCoChu"
    >A<span class="tt-plus" aria-hidden="true">+</span></button>

    <button
      class="tt-btn"
      type="button"
      :class="{ active: tuongPhanCao }"
      :aria-pressed="tuongPhanCao"
      :aria-label="tuongPhanCao ? 'Tắt tương phản cao' : 'Bật tương phản cao'"
      :title="tuongPhanCao ? 'Tắt tương phản cao' : 'Tương phản cao'"
      @click="chuyenTuongPhan"
    >
      <span aria-hidden="true">◐</span>
    </button>
  </div>
</template>

<style scoped>
.a11y-toggles {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.tt-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 38px;
  height: 38px;
  padding: 0 8px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: transparent;
  color: var(--ink);
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease, background 0.2s ease;
}
.tt-btn:hover {
  border-color: var(--ink);
  transform: translateY(-1px);
}
.tt-btn.active {
  background: var(--pine-deep);
  color: var(--fog);
  border-color: var(--pine-deep);
}
.tt-font {
  font-family: 'Fraunces', serif;
  font-weight: 600;
}
.tt-plus {
  font-size: 10px;
  vertical-align: super;
}


/* Mobile: header chật → chỉ giữ nút sáng/tối, ẩn A+ (cỡ chữ) và ◐ (tương phản).
   Đặt trong scoped để thắng độ ưu tiên; PC (>=1024px) giữ đủ 3 nút. */
@media (max-width: 1023px) {
  .a11y-toggles .tt-font,
  .a11y-toggles .tt-btn:last-child { display: none; }
}
</style>