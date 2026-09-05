<script setup lang="ts">
import { ref } from 'vue'
import InstallButton from '@/components/InstallButton.vue'

// Thay cho đoạn thao tác style.cssText trực tiếp trong script.js cũ,
// giờ dùng state phản ứng (reactive state) của Vue — idiomatic hơn.
const isMenuOpen = ref(false)
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
      <nav class="nav-links" :style="isMenuOpen ? 'display:flex; position:absolute; top:100%; left:0; right:0; background:#f5f1e6; flex-direction:column; padding:20px 28px; border-bottom:1px solid rgba(42,42,36,0.14); gap:16px;' : ''">
        <a href="#gioi-thieu">Giới thiệu</a>
        <a href="#ban-do">Bản đồ</a>
        <a href="#quy-trinh">Quy trình</a>
        <a href="#tinh-nang">Tính năng</a>
      </nav>
      <div class="nav-cta">
        <!-- <RouterLink to="/map" class="btn btn-ghost">Xem bản đồ</RouterLink> -->
         <a href="#ban-do" class="btn btn-primary">Xem bản đồ cứu trợ</a>
        <InstallButton />
      </div>
      <button class="menu-btn" aria-label="Mở menu" @click="isMenuOpen = !isMenuOpen">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M3 6H19M3 11H19M3 16H19" stroke="#2a2a24" stroke-width="1.6" stroke-linecap="round"/></svg>
      </button>
    </div>
  </header>
</template>