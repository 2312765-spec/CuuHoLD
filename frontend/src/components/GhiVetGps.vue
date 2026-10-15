<script setup lang="ts">
// SRS F-PWA-04 — bộ ghi vết GPS chạy ở MỌI trang (mount ở App.vue, ngoài <RouterView>, không bị
// huỷ khi chuyển trang). Chỉ ghi khi người dùng đã tự bật ở trang Hồ sơ (vetGps.store.ts).
// Hẹn giờ 30s nhưng store chỉ thực sự ghi khi đã đủ 2 phút kể từ điểm trước — nhờ vậy lúc app
// quay lại từ nền (trình duyệt đã tạm dừng hẹn giờ) sẽ ghi bù ngay thay vì chờ thêm 2 phút.
import { onMounted, onBeforeUnmount } from 'vue'
import { useVetGpsStore } from '@/stores/vetGps.store'

const store = useVetGpsStore()
let hen: ReturnType<typeof setInterval> | null = null

function khiHienLai() {
  if (document.visibilityState === 'visible') void store.ghiNeuDenHan()
}

onMounted(() => {
  void store.ghiNeuDenHan()
  hen = setInterval(() => void store.ghiNeuDenHan(), 30_000)
  document.addEventListener('visibilitychange', khiHienLai)
})

onBeforeUnmount(() => {
  if (hen) clearInterval(hen)
  document.removeEventListener('visibilitychange', khiHienLai)
})
</script>

<template>
  <span hidden></span>
</template>
