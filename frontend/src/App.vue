<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import InstallPromptBar from '@/components/InstallPromptBar.vue'
import ConnectionStatusBar from '@/components/ConnectionStatusBar.vue'
import QuickCallBar from '@/components/QuickCallBar.vue'
// App.vue chỉ đóng vai trò khung chứa route — toàn bộ nội dung thật nằm trong
// src/views/HomeView.vue (trang chủ) và src/views/MapView.vue (trang bản đồ).
//
// ⚠️ mode="out-in" bên dưới đặt ra một ràng buộc lên MỌI view trong router: mỗi view PHẢI
// render đúng MỘT root node. Chế độ này chỉ mount view mới sau khi view cũ báo "đã rời
// xong"; tín hiệu đó đi qua transition hook mà Vue gắn lên một phần tử DOM đơn của view.
// View trả về nhiều root node (fragment) làm hook bị gắn nhầm chỗ, afterLeave — nơi Vue
// gọi instance.update() để render view kế tiếp — không bao giờ chạy, và view mới KHÔNG
// BAO GIỜ được mount: trang trắng, phải F5. Lưu ý một comment HTML đặt cạnh thẻ gốc trong
// <template> cũng bị tính là root node thứ hai ở dev, nên chú thích kiểu này phải để trong
// <script> như ở đây. HomeView.vue từng dính đúng lỗi này (xem chú thích trong file đó).

const authStore = useAuthStore()
const route = useRoute()
const router = useRouter()

// Mất phiên khi đang đứng ở trang cần quyền → đưa về trang chủ (cổng đăng nhập).
// Đặt ở App.vue chứ không nhét router.push vào từng nút đăng xuất, vì phiên có thể mất
// theo 3 đường: nút đăng xuất ở RescuerView/DashboardView, nút trên thanh trên cùng của
// /map, VÀ interceptor 401 trong services/http.ts tự đăng xuất khi token hết hạn — đường
// thứ ba không có nút nào để gắn điều hướng, nên cách sửa từng nút sẽ bỏ sót đúng nó.
// Trước đây cả 3 đường đều để người dùng kẹt lại trang trắng không có quyền xem.
//
// CHỈ đá khỏi route có meta.requiresAuth. /map là trang công khai (router/index.ts) nên
// đăng xuất tại đó thì ở lại xem tiếp dạng chỉ-xem, không giật người dùng đi đâu cả.
// replace chứ không push: không để lại trang đã mất quyền trong lịch sử, tránh bấm Back
// quay lại rồi bị guard đá về lần nữa.
watch(
  () => authStore.isLoggedIn,
  (dangDangNhap) => {
    if (!dangDangNhap && route.meta.requiresAuth) {
      void router.replace({ name: 'home' })
    }
  }
)
</script>

<template>
  <RouterView v-slot="{ Component }">
    <transition name="page-fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>
  <!-- Ngoài <RouterView> có chủ đích: không bị huỷ/tạo lại mỗi lần chuyển trang, xem
       comment trong InstallPromptBar.vue để biết lý do đây là phần fix chính. -->
  <InstallPromptBar />
    <!-- Cùng lý do đặt ngoài <RouterView> như InstallPromptBar: không bị huỷ/tạo lại khi chuyển trang. -->
  <ConnectionStatusBar />
  <QuickCallBar />
</template>