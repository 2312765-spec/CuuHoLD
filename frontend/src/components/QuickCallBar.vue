<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

// Gọi khẩn cấp nhanh (F-SOS-05 trong SRS Mục 3.6). Nút nổi mở ra danh sách tổng đài, bấm
// là gọi thẳng bằng liên kết tel: — KHÔNG cần đăng nhập và KHÔNG cần internet (cuộc gọi đi
// qua mạng di động), nên luôn dùng được ngay cả khi app đang offline hay chưa có tài khoản.
//
// Gắn ở App.vue, NGOÀI <RouterView>. Ẩn ở /map và /dashboard (giống InstallPromptBar) vì hai
// trang bản đồ toàn màn hình đã có nút SOS và các control riêng ở cạnh dưới — nhồi thêm nút
// nổi vào đó dễ đè lên đúng thứ người dùng cần bấm lúc khẩn cấp.

const HOTLINES = [
  { so: '112', nhan: 'Ứng cứu khẩn cấp' },
  { so: '113', nhan: 'Công an' },
  { so: '114', nhan: 'Cứu nạn – cứu hộ, PCCC' },
  { so: '115', nhan: 'Cấp cứu y tế' }
] as const

const route = useRoute()
const anOTrang = new Set(['map', 'dashboard'])
const coTheHien = computed(() => !anOTrang.has(route.name as string))

const moRong = ref(false)
</script>

<template>
  <div v-if="coTheHien" class="qc-wrap">
    <transition name="qc-fade">
      <div v-if="moRong" class="qc-menu" role="menu">
        <a v-for="h in HOTLINES" :key="h.so" :href="`tel:${h.so}`" class="qc-item" role="menuitem">
          <span class="qc-so">{{ h.so }}</span>
          <span class="qc-nhan">{{ h.nhan }}</span>
        </a>
      </div>
    </transition>
    <button
      class="qc-fab"
      type="button"
      :aria-expanded="moRong"
      aria-label="Gọi khẩn cấp"
      @click="moRong = !moRong"
    >
      <span class="qc-fab-icon" aria-hidden="true">{{ moRong ? '✕' : '📞' }}</span>
      <span class="qc-fab-text">{{ moRong ? 'Đóng' : 'Gọi khẩn cấp' }}</span>
    </button>
  </div>
</template>

<style scoped>
.qc-wrap {
  position: fixed;
  right: 16px;
  /* Nằm trên banner cài đặt (InstallPromptBar, bottom:0) để không che nhau; dưới .toast. */
  bottom: 76px;
  z-index: 2500;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 10px;
}
.qc-fab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border: none;
  border-radius: 999px;
  background: var(--clay);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 20px rgba(168, 70, 43, 0.4);
  transition: transform 0.15s ease, background 0.2s ease;
}
.qc-fab:hover {
  transform: translateY(-2px);
  background: var(--clay-soft);
}
.qc-fab-icon {
  font-size: 16px;
  line-height: 1;
}
.qc-menu {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  background: var(--pine-deep);
  box-shadow: 0 10px 28px rgba(20, 39, 32, 0.35);
  min-width: 210px;
}
.qc-item {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 10px;
  text-decoration: none;
  color: var(--fog);
  transition: background 0.15s ease;
}
.qc-item:hover {
  background: rgba(245, 241, 230, 0.1);
}
.qc-so {
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  font-weight: 700;
  color: var(--amber);
  min-width: 46px;
}
.qc-nhan {
  font-size: 13px;
  line-height: 1.3;
}
.qc-fade-enter-active,
.qc-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.qc-fade-enter-from,
.qc-fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>