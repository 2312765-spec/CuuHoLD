<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useOfflineQueueStore } from '@/stores/offlineQueue'

// Chỉ báo trạng thái kết nối (F-UI-04 trong SRS Mục 3.6). Gắn ở App.vue, NGOÀI <RouterView>
// (giống InstallPromptBar) nên không bị huỷ/tạo lại mỗi lần chuyển trang.
//
// Tự nghe sự kiện online/offline của TRÌNH DUYỆT tại đây, ĐỘC LẬP với offlineQueueStore.khoiTao()
// — hàm đó chỉ MapView gọi và có logic dọn listener rất cẩn thận; cố tình không đụng vào để
// khỏi giẫm chân nhau. Số SOS đang chờ thì đọc ref soLuongSosChoGui của store (store tự cập
// nhật mỗi khi lưu/gửi lại), chỉ hiển thị thêm khi > 0.

const online = ref(navigator.onLine)

// Sau khi có mạng lại, giữ dải "đã kết nối lại" vài giây rồi ẩn — cho người dùng một phản
// hồi tích cực rõ ràng thay vì dải biến mất lặng lẽ.
const vuaKetNoiLai = ref(false)
let henAn: ReturnType<typeof setTimeout> | null = null

function khiOnline(): void {
  online.value = true
  vuaKetNoiLai.value = true
  if (henAn) clearTimeout(henAn)
  henAn = setTimeout(() => { vuaKetNoiLai.value = false }, 4000)
}
function khiOffline(): void {
  online.value = false
}

onMounted(() => {
  window.addEventListener('online', khiOnline)
  window.addEventListener('offline', khiOffline)
})
onUnmounted(() => {
  window.removeEventListener('online', khiOnline)
  window.removeEventListener('offline', khiOffline)
  if (henAn) clearTimeout(henAn)
})

const { soLuongSosChoGui } = storeToRefs(useOfflineQueueStore())

const hien = computed(() => !online.value || vuaKetNoiLai.value)
</script>

<template>
  <div
    v-if="hien"
    class="conn-bar"
    :class="online ? 'conn-online' : 'conn-offline'"
    role="status"
    aria-live="polite"
  >
    <span class="conn-dot" aria-hidden="true" />
    <template v-if="!online">
      <span class="conn-text">Đang ngoại tuyến — thao tác được lưu và tự gửi khi có mạng lại</span>
      <span v-if="soLuongSosChoGui > 0" class="conn-count">{{ soLuongSosChoGui }} SOS chờ gửi</span>
    </template>
    <span v-else class="conn-text">Đã kết nối lại</span>
  </div>
</template>

<style scoped>
.conn-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  /* Cao hơn header (sticky) và banner cài đặt để luôn thấy được; thấp hơn .toast
     (z-index:3000 trong style.css) vì toast báo kết quả hành động tức thời quan trọng hơn. */
  z-index: 2600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 7px 16px;
  font-size: 13px;
  font-weight: 500;
  line-height: 1.35;
  text-align: center;
  color: #fff;
}
.conn-offline {
  background: var(--clay);
}
.conn-online {
  background: var(--sage);
}
.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #fff;
  flex-shrink: 0;
}
.conn-offline .conn-dot {
  animation: conn-pulse 1.2s ease-in-out infinite;
}
.conn-count {
  padding: 1px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 12px;
  white-space: nowrap;
}
@keyframes conn-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>