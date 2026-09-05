<script setup lang="ts">
import { useInstallPrompt } from '@/composables/useInstallPrompt'

const { coTheCaiDat, laIOS, daCaiDatSan, caiDat } = useInstallPrompt()
</script>

<template>
  <!-- Android/desktop Chrome/Edge: nút thật, bấm là bật hộp thoại cài đặt của trình duyệt -->
  <button v-if="coTheCaiDat" class="btn btn-primary install-btn" @click="caiDat">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2V10M8 10L5 7M8 10L11 7M3 13H13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Cài đặt ứng dụng
  </button>

  <!-- iOS: không có API để tự bật hộp thoại — chỉ hiện hướng dẫn thao tác tay -->
  <div v-else-if="laIOS && !daCaiDatSan" class="install-hint">
    Trên iPhone: bấm nút <strong>Chia sẻ</strong> ở thanh trình duyệt → chọn
    <strong>"Thêm vào MH chính"</strong> để cài app.
  </div>
</template>