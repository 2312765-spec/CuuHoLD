<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useInstallPrompt } from '@/composables/useInstallPrompt'

// Gắn Ở APP.VUE (xem App.vue), NGOÀI <RouterView>/<transition> — component này vì vậy
// không bao giờ bị unmount khi chuyển trang. Trước đây nút cài đặt nằm trong AppHeader.vue,
// chỉ được mount ở HomeView: mỗi lần rời Home (qua /map) rồi quay lại, AppHeader tạo lại
// từ đầu, gọi lại useInstallPrompt() với state MỚI (coTheCaiDat=false) — trong khi sự kiện
// trình duyệt 'beforeinstallprompt' chỉ bắn ĐÚNG MỘT LẦN cho cả phiên, thường đã bắn từ
// trước đó rồi. Kết quả: nút biến mất vĩnh viễn sau lần điều hướng đầu tiên. Đặt component
// (và do đó, lệnh gọi composable) ở App.vue — nơi không bao giờ bị huỷ trong suốt phiên SPA —
// sửa tận gốc, không cần sửa gì trong useInstallPrompt.ts.
const { coTheCaiDat, laIOS, daCaiDatSan, caiDat } = useInstallPrompt()

const route = useRoute()
const daDong = ref(false)

// /map và /dashboard là các trang bản đồ toàn màn hình, đã kín 4 góc bởi thanh trạng thái,
// chú thích, nút SOS... (xem map-style.css) — nhồi thêm một thanh cố định ở đây dễ đè lên
// đúng những control người dùng cần thấy nhất lúc khẩn cấp. Ẩn banner ở 2 trang này, không
// tắt tính năng cài đặt (state vẫn sống, chỉ là không hiện UI); banner hiện lại ngay khi rời
// khỏi 2 trang đó, không cần người dùng làm gì thêm.
const anO = new Set(['map', 'dashboard'])

const coTheHien = computed(
  () => !daDong.value && !daCaiDatSan.value && !anO.has(route.name as string)
)

const hienNutThat = computed(() => coTheHien.value && coTheCaiDat.value)
const hienGoiYIOS = computed(() => coTheHien.value && laIOS.value && !coTheCaiDat.value)
</script>

<template>
  <div v-if="hienNutThat || hienGoiYIOS" class="install-bar">
    <span v-if="hienNutThat" class="install-bar-text">Cài ứng dụng lên máy để dùng nhanh hơn, kể cả khi mất mạng</span>
    <span v-else class="install-bar-text">
      Trên iPhone: bấm nút <strong>Chia sẻ</strong> ở thanh trình duyệt → chọn <strong>"Thêm vào MH chính"</strong> để cài app.
    </span>

    <button v-if="hienNutThat" class="btn btn-primary install-bar-btn" @click="caiDat">Cài đặt</button>
    <button class="install-bar-close" aria-label="Đóng" @click="daDong = true">✕</button>
  </div>
</template>

<style scoped>
.install-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* Thấp hơn .toast (z-index:3000, style.css) có chủ đích: toast báo kết quả hành động
     (gửi SOS, lỗi mạng...) quan trọng hơn tức thời, không được để banner này che mất
     nếu cả hai cùng hiện một lúc ở góc dưới màn hình. */
  z-index: 2000;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px;
  background: var(--pine-deep);
  color: var(--fog);
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 -4px 16px rgba(20, 39, 32, 0.25);
}
.install-bar-text {
  flex: 1;
  min-width: 0;
}
.install-bar-text strong {
  color: var(--amber);
}
.install-bar-btn {
  flex-shrink: 0;
  padding: 8px 18px;
  font-size: 13px;
  white-space: nowrap;
}
.install-bar-close {
  flex-shrink: 0;
  background: none;
  border: none;
  color: var(--fog);
  opacity: 0.7;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  padding: 4px 6px;
}
.install-bar-close:hover {
  opacity: 1;
}
</style>
