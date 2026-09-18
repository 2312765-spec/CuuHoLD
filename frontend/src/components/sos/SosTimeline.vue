<script setup lang="ts">
import type { SosTimelineRow } from '@/types'

defineProps<{
  timeline: SosTimelineRow[]
}>()

const ACTION_LABEL: Record<string, string> = {
  created: 'Đã tạo yêu cầu',
  assigned: 'Đã phân công đội',
  in_progress: 'Đội đang di chuyển',
  arrived: 'Đội đã đến nơi',
  resolved: 'Đã hoàn thành',
  cancelled: 'Đã huỷ',
  false_alarm: 'Báo động giả'
}

function nhanAction(action: string): string {
  return ACTION_LABEL[action] ?? action
}

function mauMoc(action: string): string {
  if (action === 'resolved') return '#6f8f74'
  if (action === 'cancelled' || action === 'false_alarm') return '#a8462b'
  return '#1f3d2e'
}

function gioPhut(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
}
</script>

<template>
  <div class="sos-timeline">
    <h4 class="sos-timeline-title">Lịch sử xử lý</h4>
    <p v-if="!timeline.length" class="sos-timeline-empty">Chưa có mốc xử lý nào.</p>
    <ul v-else class="sos-timeline-list">
      <li v-for="row in timeline" :key="row.id" class="sos-timeline-item">
        <span class="sos-timeline-dot" :style="{ background: mauMoc(row.action) }"></span>
        <div class="sos-timeline-content">
          <span class="sos-timeline-action">{{ nhanAction(row.action) }}</span>
          <span class="sos-timeline-time">{{ gioPhut(row.created_at) }}</span>
          <p v-if="row.note" class="sos-timeline-note">{{ row.note }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sos-timeline { margin-top: 4px; }
.sos-timeline-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--pine-deep, #142720);
  margin: 0 0 10px;
}
.sos-timeline-empty {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
  margin: 0;
}
.sos-timeline-list {
  list-style: none;
  margin: 0;
  padding: 0;
  position: relative;
}
.sos-timeline-list::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 6px;
  bottom: 6px;
  width: 1.5px;
  background: rgba(42, 42, 36, 0.14);
}
.sos-timeline-item {
  position: relative;
  display: flex;
  gap: 12px;
  padding-bottom: 14px;
}
.sos-timeline-item:last-child { padding-bottom: 0; }
.sos-timeline-dot {
  position: relative;
  z-index: 1;
  flex-shrink: 0;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #fff;
  margin-top: 2px;
}
.sos-timeline-content {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
.sos-timeline-action {
  font-size: 13px;
  font-weight: 500;
  color: var(--ink, #2a2a24);
}
.sos-timeline-time {
  font-size: 11px;
  color: rgba(42, 42, 36, 0.5);
}
.sos-timeline-note {
  margin: 3px 0 0;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.7);
  font-style: italic;
}
</style>