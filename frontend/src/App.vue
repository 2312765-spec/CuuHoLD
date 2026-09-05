<script setup lang="ts">
// App.vue chỉ đóng vai trò khung chứa route — toàn bộ nội dung thật nằm trong
// src/views/HomeView.vue (trang chủ) và src/views/MapView.vue (trang bản đồ).
</script>

<template>
  <RouterView v-slot="{ Component }">
    <transition name="page-fade" mode="out-in">
      <component :is="Component" />
    </transition>
  </RouterView>
</template>