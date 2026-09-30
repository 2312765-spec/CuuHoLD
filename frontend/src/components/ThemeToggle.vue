<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useTheme } from '@/composables/useTheme'

// Cài đặt hiển thị & tiếp cận (F-UI-05 + F-UI-06): giao diện tối, chữ lớn, tương phản cao.
// Trước đây là 3 nút biểu tượng nằm sẵn trên header — chật, và biểu tượng (🌙, A+, ◐) không nói
// rõ tác dụng. Giờ gom vào 1 nút ⚙: bấm mở bảng có chữ rõ ràng; đóng bằng ✕, Esc, hoặc bấm ra
// ngoài (cùng cách với bảng thông báo). Chuông thông báo cố ý để NGOÀI (cần thấy số chưa đọc).
const { theme, fontScale, contrast, chuyenTheme, chuyenCoChu, chuyenTuongPhan } = useTheme()

const laToi = computed(() => theme.value === 'dark')
const chuLon = computed(() => fontScale.value === 'large')
const tuongPhanCao = computed(() => contrast.value === 'high')

const moRong = ref(false)
const goc = ref<HTMLElement | null>(null)

function dong() {
  moRong.value = false
}
function khiBamNgoai(e: MouseEvent) {
  if (moRong.value && goc.value && !goc.value.contains(e.target as Node)) dong()
}
function khiBamPhim(e: KeyboardEvent) {
  if (e.key === 'Escape' && moRong.value) dong()
}
onMounted(() => {
  document.addEventListener('click', khiBamNgoai)
  document.addEventListener('keydown', khiBamPhim)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', khiBamNgoai)
  document.removeEventListener('keydown', khiBamPhim)
})
</script>

<template>
  <div ref="goc" class="tt-goc">
    <button
      class="tt-btn"
      type="button"
      data-test="mo-cai-dat"
      aria-label="Cài đặt hiển thị"
      title="Cài đặt hiển thị"
      aria-controls="bang-cai-dat"
      :aria-expanded="moRong"
      @click="moRong = !moRong"
    >
      <span aria-hidden="true">⚙️</span>
    </button>

    <div
      v-if="moRong"
      id="bang-cai-dat"
      class="tt-panel"
      role="dialog"
      aria-label="Cài đặt hiển thị"
      data-test="bang-cai-dat"
    >
      <div class="tt-panel-dau">
        <span>Hiển thị</span>
        <button class="tt-dong" type="button" data-test="dong-cai-dat" aria-label="Đóng cài đặt" @click="dong">✕</button>
      </div>

      <button class="tt-dong-cai-dat" type="button" role="switch" data-test="cai-dat-toi" :aria-checked="laToi" @click="chuyenTheme">
        <span class="tt-nhan"><span aria-hidden="true">🌙</span> Giao diện tối</span>
        <span class="tt-cong-tac" :class="{ bat: laToi }" aria-hidden="true"></span>
      </button>
      <button class="tt-dong-cai-dat" type="button" role="switch" data-test="cai-dat-chu" :aria-checked="chuLon" @click="chuyenCoChu">
        <span class="tt-nhan"><span aria-hidden="true">A+</span> Chữ lớn</span>
        <span class="tt-cong-tac" :class="{ bat: chuLon }" aria-hidden="true"></span>
      </button>
      <button class="tt-dong-cai-dat" type="button" role="switch" data-test="cai-dat-tuong-phan" :aria-checked="tuongPhanCao" @click="chuyenTuongPhan">
        <span class="tt-nhan"><span aria-hidden="true">◐</span> Tương phản cao</span>
        <span class="tt-cong-tac" :class="{ bat: tuongPhanCao }" aria-hidden="true"></span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.tt-goc {
  position: relative;
  display: inline-flex;
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
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 0.2s ease, transform 0.15s ease;
}
.tt-btn:hover {
  border-color: var(--ink);
  transform: translateY(-1px);
}
.tt-btn:focus-visible,
.tt-dong:focus-visible,
.tt-dong-cai-dat:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: 2px;
}
/* Bảng luôn nền sáng (giống bảng thông báo) — chữ tối cố định, không đổi theo dark mode. */
.tt-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  z-index: 1200;
  width: 250px;
  padding: 8px;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: #fbf8f1;
  color: #2a2a24;
  color-scheme: light;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
}
.tt-panel-dau {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 6px 8px 10px;
  font-weight: 600;
  font-size: 14px;
}
.tt-dong {
  display: inline-grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: #2a2a24;
  cursor: pointer;
}
.tt-dong:hover {
  background: rgba(42, 42, 36, 0.08);
}
.tt-dong-cai-dat {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  min-height: 44px;
  padding: 0 10px;
  border: 0;
  border-radius: 10px;
  background: transparent;
  color: #2a2a24;
  font: 500 14px/1.2 'Inter', sans-serif;
  text-align: left;
  cursor: pointer;
}
.tt-dong-cai-dat:hover {
  background: rgba(42, 42, 36, 0.06);
}
.tt-nhan {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.tt-nhan > span {
  width: 22px;
  text-align: center;
}
/* Công tắc gạt: xám = tắt, xanh thông = bật (kèm chấm trượt — không chỉ dựa vào màu). */
.tt-cong-tac {
  position: relative;
  flex-shrink: 0;
  width: 38px;
  height: 22px;
  border-radius: 11px;
  background: rgba(42, 42, 36, 0.25);
  transition: background 0.2s ease;
}
.tt-cong-tac::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 3px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ffffff;
  transition: transform 0.2s ease;
}
.tt-cong-tac.bat {
  background: var(--pine-deep);
}
.tt-cong-tac.bat::after {
  transform: translateX(16px);
}
@media (prefers-reduced-motion: reduce) {
  .tt-cong-tac,
  .tt-cong-tac::after,
  .tt-btn {
    transition: none;
  }
}
</style>
