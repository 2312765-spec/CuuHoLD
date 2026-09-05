<script setup lang="ts">
defineProps<{
  title: string
  subtitle: string
  badge?: string
  showAction?: boolean
}>()

const emit = defineEmits<{ action: [] }>()
</script>

<template>
  <div class="marker-popup-card">
    <b>{{ title }}</b>
    <span>{{ subtitle }}</span>
    <span v-if="badge" class="popup-badge">{{ badge }}</span>
    <button v-if="showAction" class="popup-action-btn" @click="emit('action')">
      Đánh dấu đã xử lý
    </button>
  </div>
</template>