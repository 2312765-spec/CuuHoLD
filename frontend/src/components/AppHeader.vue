<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useCtaTheoRole } from '@/composables/useCtaTheoRole'

// Thay cho đoạn thao tác style.cssText trực tiếp trong script.js cũ,
// giờ dùng state phản ứng (reactive state) của Vue — idiomatic hơn.
const isMenuOpen = ref(false)

// Link "Đăng nhập" riêng trong menu đã bỏ: nút CTA giờ vừa là lối đăng nhập (khi chưa
// đăng nhập) vừa là lối vào khu làm việc đúng role (khi đã đăng nhập), nên có thêm một
// link đăng nhập nữa là thừa và tạo ra 2 chỗ phải đồng bộ. Vẫn giữ tên + "Đăng xuất" để
// người đang đăng nhập có lối thoát ngay tại trang chủ.
defineEmits<{ openAuth: [] }>()
const authStore = useAuthStore()
const { cta } = useCtaTheoRole()
</script>

<template>
  <header>
    <div class="nav">
      <div class="brand">
        <svg class="mark" viewBox="0 0 30 30" fill="none">
          <path d="M2 22L11 8L16 16L20 10L28 22" stroke="#a8462b" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
          <circle cx="20" cy="10" r="2" fill="#1f3d2e"/>
        </svg>
        Bản Đồ Cứu Trợ Lâm Đồng
      </div>
      <nav class="nav-links" :class="{ open: isMenuOpen }">
        <a href="#gioi-thieu">Giới thiệu</a>
        <a href="#ban-do">Bản đồ</a>
        <a href="#quy-trinh">Quy trình</a>
        <a href="#tinh-nang">Tính năng</a>
        <!-- Đặt trong .nav-links (không phải .nav-cta) vì .nav-cta .btn-ghost bị ẩn hẳn
             trên mobile (style.css dòng ~161) — để đây thì vẫn hiện trong menu hamburger. -->
        <template v-if="authStore.isLoggedIn">
          <span class="nav-user">{{ authStore.user?.name }}</span>
          <a href="#" @click.prevent="authStore.logout()">Đăng xuất</a>
        </template>
      </nav>
      <div class="nav-cta">
        <RouterLink v-if="cta.dich" :to="cta.dich" class="btn btn-primary">{{ cta.nhan }}</RouterLink>
        <button v-else class="btn btn-primary" @click="$emit('openAuth')">{{ cta.nhan }}</button>
      </div>
      <button class="menu-btn" aria-label="Mở menu" @click="isMenuOpen = !isMenuOpen">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6H19M3 11H19M3 16H19" stroke="#2a2a24" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>
</template>