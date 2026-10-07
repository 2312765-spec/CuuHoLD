<script setup lang="ts">
// Hệ thống (commander): trạng thái DB, tích hợp ngoài đã cấu hình chưa, số liệu tổng quan và
// nhật ký hoạt động gần đây. CHỈ ĐỌC — cấu hình thật nằm ở biến môi trường (.env) của máy chủ,
// không sửa được qua web (và không bao giờ hiển thị giá trị key/secret).

import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { layTrangThaiHeThong, layNhatKyHoatDong } from '@/services/systemService'
import type { SystemStatus, ActivityLogEntry } from '@/types'

const authStore = useAuthStore()
const toastStore = useToastStore()

const status = ref<SystemStatus | null>(null)
const activity = ref<ActivityLogEntry[]>([])
const loading = ref(false)

const ACTION_LABEL: Record<string, string> = {
  created: 'Tạo SOS',
  assigned: 'Phân công đội',
  in_progress: 'Bắt đầu di chuyển',
  arrived: 'Đã đến nơi',
  resolved: 'Hoàn tất cứu hộ',
  cancelled: 'Huỷ SOS',
  hazard_created: 'Tạo cảnh báo chặn đường',
  hazard_resolved: 'Gỡ cảnh báo chặn đường'
}
const ROLE_LABEL: Record<string, string> = {
  victim: 'Người dân',
  rescuer: 'Cứu hộ',
  commander: 'Chỉ huy'
}

function nhanHanhDong(action: string): string {
  return ACTION_LABEL[action] ?? action
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function formatUptime(giay: number): string {
  const h = Math.floor(giay / 3600)
  const m = Math.floor((giay % 3600) / 60)
  return h > 0 ? `${h} giờ ${m} phút` : `${m} phút`
}

async function taiDuLieu(): Promise<void> {
  loading.value = true
  try {
    const [s, a] = await Promise.all([layTrangThaiHeThong(), layNhatKyHoatDong(50)])
    status.value = s
    activity.value = a
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void taiDuLieu()
})
</script>

<template>
  <div class="system-page">
    <header class="system-top">
      <div class="system-top-left">
        <h1>Hệ thống &amp; nhật ký</h1>
        <RouterLink to="/dashboard" class="system-back">← Bảng điều phối</RouterLink>
      </div>
      <div class="system-top-right">
        <button class="btn btn-ghost" :disabled="loading" @click="taiDuLieu">
          {{ loading ? 'Đang tải...' : 'Làm mới' }}
        </button>
        <span class="system-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
      </div>
    </header>

    <main class="system-body">
      <div v-if="loading && !status" class="panel-empty">Đang tải...</div>

      <template v-if="status">
        <section class="system-section">
          <h2>Trạng thái dịch vụ</h2>
          <ul class="status-list">
            <li>
              <span class="dot" :class="status.database.ok ? 'ok' : 'bad'"></span>
              <b>Cơ sở dữ liệu (Supabase)</b>
              <span class="status-note">
                {{ status.database.ok ? `Hoạt động · ${status.database.latency_ms} ms` : 'Không kết nối được' }}
              </span>
            </li>
            <li>
              <span class="dot" :class="status.integrations.ors_configured ? 'ok' : 'warn'"></span>
              <b>Dẫn đường (OpenRouteService)</b>
              <span class="status-note">
                {{ status.integrations.ors_configured ? 'Đã cấu hình' : 'Chưa cấu hình — rescuer chỉ thấy đường chim bay' }}
              </span>
            </li>
            <li>
              <span class="dot" :class="status.integrations.esms_configured ? 'ok' : 'warn'"></span>
              <b>SMS dự phòng (eSMS)</b>
              <span class="status-note">
                {{ status.integrations.esms_configured ? 'Đã cấu hình' : 'Chưa cấu hình — không gửi được SMS' }}
              </span>
            </li>
            <li>
              <span class="dot" :class="status.integrations.esms_brandname_configured ? 'ok' : 'warn'"></span>
              <b>Brandname eSMS</b>
              <span class="status-note">
                {{ status.integrations.esms_brandname_configured ? 'Đã khai báo' : 'Trống — SmsType=2 sẽ báo lỗi 104' }}
              </span>
            </li>
          </ul>
          <p class="section-hint">
            Môi trường: {{ status.node_env }} · Máy chủ chạy được {{ formatUptime(status.uptime_seconds) }}.
            Giá trị key/secret chỉ nằm trong file .env của máy chủ, không hiển thị và không sửa qua web.
          </p>
        </section>

        <section class="system-section">
          <h2>Số liệu tổng quan</h2>
          <div class="summary-grid">
            <div v-for="r in status.counts.users_by_role" :key="r.key" class="summary-card">
              <b>{{ r.count }}</b><span>{{ ROLE_LABEL[r.key] ?? r.key }}</span>
            </div>
            <div class="summary-card"><b>{{ status.counts.rescue_teams }}</b><span>Đội cứu hộ</span></div>
            <div class="summary-card"><b>{{ status.counts.active_hazards }}</b><span>Cảnh báo chặn đường</span></div>
            <div class="summary-card"><b>{{ status.counts.flagged_users }}</b><span>Tài khoản bị cảnh báo</span></div>
            <div class="summary-card"><b>{{ status.counts.inactive_users }}</b><span>Tài khoản bị khoá</span></div>
          </div>
        </section>

        <section class="system-section">
          <h2>Nhật ký hoạt động gần đây</h2>
          <div v-if="activity.length === 0" class="panel-empty">Chưa có hoạt động nào.</div>
          <ul v-else class="log-list">
            <li v-for="(e, i) in activity" :key="i" class="log-item" :class="`kind-${e.kind}`">
              <div class="log-top">
                <b>{{ nhanHanhDong(e.action) }}</b>
                <span class="log-time">{{ formatTime(e.at) }}</span>
              </div>
              <div class="log-meta">
                {{ e.actor_name ?? 'Hệ thống' }}<template v-if="e.detail"> · {{ e.detail }}</template>
              </div>
            </li>
          </ul>
        </section>
      </template>
    </main>

    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
  </div>
</template>

<style scoped>
.system-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--fog);
}
.system-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.94);
}
.system-top-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.system-top-left h1 {
  font-size: 18px;
}
.system-back {
  font-size: 13px;
  color: var(--pine-deep);
  text-decoration: none;
  opacity: 0.75;
}
.system-back:hover {
  opacity: 1;
  text-decoration: underline;
}
.system-top-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.system-user {
  font-size: 13px;
  color: var(--pine-deep);
  font-weight: 500;
}
.system-body {
  flex: 1;
  padding: 24px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}
.panel-empty {
  padding: 24px 20px;
  text-align: center;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}
.system-section {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 18px;
}
.system-section h2 {
  font-size: 15px;
  margin-bottom: 12px;
}
.section-hint {
  margin-top: 12px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
}
.status-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.status-list li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13px;
  flex-wrap: wrap;
}
.status-note {
  color: rgba(42, 42, 36, 0.6);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #9ca3af;
  flex: none;
}
.dot.ok {
  background: #16a34a;
}
.dot.warn {
  background: #eab308;
}
.dot.bad {
  background: #dc2626;
}
.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 12px;
}
.summary-card {
  border: 1px solid var(--line);
  border-radius: 10px;
  padding: 14px;
  text-align: center;
}
.summary-card b {
  display: block;
  font-family: 'Fraunces', serif;
  font-size: 26px;
  color: var(--pine-deep);
}
.summary-card span {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
}
.log-list {
  list-style: none;
}
.log-item {
  padding: 10px 12px;
  border-bottom: 1px solid var(--line);
  border-left: 3px solid #3b82f6;
}
.log-item.kind-hazard {
  border-left-color: #b91c1c;
}
.log-top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}
.log-time {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
  white-space: nowrap;
}
.log-meta {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
}
</style>
