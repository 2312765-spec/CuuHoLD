<script setup lang="ts">
// Thống kê tổng quan (commander) — GET /api/gis/stats. Không dùng thư viện chart riêng (tránh
// thêm dependency cho vài thanh bar đơn giản) — tự vẽ bar ngang bằng CSS width%, khớp cách
// làm nhẹ-gọn đã dùng cho heatmap (DashboardView.vue vẽ vòng tròn tự tính màu, không dùng lib).

import { ref, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { layThongKeTongQuan } from '@/services/gisService'
import type { StatsResult, SosType, SosStatus, RescueTeamStatus } from '@/types'

const authStore = useAuthStore()
const toastStore = useToastStore()

const SOS_TYPE_LABEL: Record<SosType, string> = {
  flood: 'Lũ lụt',
  landslide: 'Sạt lở',
  accident: 'Tai nạn',
  medical: 'Y tế',
  fire: 'Hoả hoạn',
  lost: 'Lạc đường',
  drowning: 'Đuối nước',
  agricultural: 'Nông nghiệp',
  adventure: 'Mạo hiểm',
  other: 'Khác'
}
const SOS_STATUS_LABEL: Record<SosStatus, string> = {
  pending: 'Chờ xử lý',
  assigned: 'Đã phân công',
  in_progress: 'Đang thực hiện',
  arrived: 'Đã đến nơi',
  resolved: 'Hoàn tất',
  cancelled: 'Đã huỷ',
  false_alarm: 'Báo giả'
}
const TEAM_STATUS_LABEL: Record<RescueTeamStatus, string> = {
  available: 'Sẵn sàng',
  busy: 'Đang bận',
  offline: 'Ngoại tuyến'
}

function nhanTrangThaiSos(key: string): string {
  return SOS_STATUS_LABEL[key as SosStatus] ?? key
}
function nhanLoaiSos(key: string): string {
  return SOS_TYPE_LABEL[key as SosType] ?? key
}
function nhanTrangThaiDoi(key: string): string {
  return TEAM_STATUS_LABEL[key as RescueTeamStatus] ?? key
}

// ---------- Khoảng thời gian xem — chọn nhanh 7/30/90 ngày, mặc định 30 ----------
const soNgay = ref(30)
const stats = ref<StatsResult | null>(null)
const loading = ref(false)

async function taiThongKe(): Promise<void> {
  loading.value = true
  try {
    const to = new Date()
    const from = new Date(to.getTime() - soNgay.value * 24 * 60 * 60 * 1000)
    stats.value = await layThongKeTongQuan(from, to)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  } finally {
    loading.value = false
  }
}

function doiKhoangThoiGian(ngay: number): void {
  soNgay.value = ngay
  void taiThongKe()
}

// Tỉ lệ % so với mục lớn nhất trong CÙNG nhóm — mỗi nhóm (status/type/team) tự chuẩn hoá
// riêng, không dùng chung 1 mốc max giữa 3 nhóm (số lượng SOS và số lượng đội chênh lệch quy
// mô rất khác nhau, dùng chung mốc sẽ làm nhóm nhỏ hơn hiện toàn thanh bé tí không đọc được).
function tinhTiLe(items: { count: number }[], count: number): number {
  const max = Math.max(...items.map((i) => i.count), 1)
  return Math.round((count / max) * 100)
}

const coDuLieu = computed(() => stats.value !== null)

onMounted(() => {
  void taiThongKe()
})
</script>

<template>
  <div class="stats-page">
    <header class="stats-top">
      <div class="stats-top-left">
        <h1>Thống kê tổng quan</h1>
        <RouterLink to="/dashboard" class="stats-back">← Bảng điều phối</RouterLink>
      </div>
      <div class="stats-top-right">
        <span class="stats-user">{{ authStore.user?.name }}</span>
        <button class="btn btn-ghost" @click="authStore.logout()">Đăng xuất</button>
      </div>
    </header>

    <main class="stats-body">
      <div class="stats-toolbar">
        <div class="stats-filter">
          <button :class="{ active: soNgay === 7 }" @click="doiKhoangThoiGian(7)">7 ngày</button>
          <button :class="{ active: soNgay === 30 }" @click="doiKhoangThoiGian(30)">30 ngày</button>
          <button :class="{ active: soNgay === 90 }" @click="doiKhoangThoiGian(90)">90 ngày</button>
        </div>
      </div>

      <div v-if="loading" class="panel-empty">Đang tải...</div>
      <template v-else-if="coDuLieu && stats">
        <!-- Tổng quan -->
        <div class="stats-summary">
          <div class="summary-card">
            <b>{{ stats.total_sos }}</b>
            <span>Tổng số SOS ({{ soNgay }} ngày)</span>
          </div>
          <div class="summary-card">
            <b>{{ stats.avg_response_minutes != null ? `${stats.avg_response_minutes} phút` : '—' }}</b>
            <span>Thời gian phản hồi trung bình</span>
          </div>
          <div class="summary-card">
            <b>{{ stats.flagged_users_count }}</b>
            <span>Tài khoản bị cảnh báo (huỷ trễ nhiều lần)</span>
          </div>
        </div>

        <!-- SOS theo trạng thái -->
        <section class="stats-section">
          <h2>SOS theo trạng thái</h2>
          <div v-if="stats.sos_by_status.length === 0" class="panel-empty">Không có dữ liệu.</div>
          <div v-else class="bar-list">
            <div v-for="item in stats.sos_by_status" :key="item.key" class="bar-row">
              <span class="bar-label">{{ nhanTrangThaiSos(item.key) }}</span>
              <div class="bar-track">
                <div class="bar-fill bar-fill-status" :style="{ width: tinhTiLe(stats.sos_by_status, item.count) + '%' }"></div>
              </div>
              <span class="bar-count">{{ item.count }}</span>
            </div>
          </div>
        </section>

        <!-- SOS theo loại -->
        <section class="stats-section">
          <h2>SOS theo loại sự cố</h2>
          <div v-if="stats.sos_by_type.length === 0" class="panel-empty">Không có dữ liệu.</div>
          <div v-else class="bar-list">
            <div v-for="item in stats.sos_by_type" :key="item.key" class="bar-row">
              <span class="bar-label">{{ nhanLoaiSos(item.key) }}</span>
              <div class="bar-track">
                <div class="bar-fill bar-fill-type" :style="{ width: tinhTiLe(stats.sos_by_type, item.count) + '%' }"></div>
              </div>
              <span class="bar-count">{{ item.count }}</span>
            </div>
          </div>
        </section>

        <!-- Đội cứu hộ theo trạng thái -->
        <section class="stats-section">
          <h2>Đội cứu hộ theo trạng thái</h2>
          <p class="section-hint">Trạng thái hiện tại — không lọc theo khoảng thời gian ở trên.</p>
          <div v-if="stats.teams_by_status.length === 0" class="panel-empty">Chưa có đội nào.</div>
          <div v-else class="bar-list">
            <div v-for="item in stats.teams_by_status" :key="item.key" class="bar-row">
              <span class="bar-label">{{ nhanTrangThaiDoi(item.key) }}</span>
              <div class="bar-track">
                <div class="bar-fill bar-fill-team" :style="{ width: tinhTiLe(stats.teams_by_status, item.count) + '%' }"></div>
              </div>
              <span class="bar-count">{{ item.count }}</span>
            </div>
          </div>
        </section>
      </template>
    </main>

    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--fog);
}
.stats-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 24px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.94);
}
.stats-top-left {
  display: flex;
  align-items: baseline;
  gap: 16px;
}
.stats-top-left h1 {
  font-size: 18px;
}
.stats-back {
  font-size: 13px;
  color: var(--pine-deep);
  text-decoration: none;
  opacity: 0.75;
}
.stats-back:hover {
  opacity: 1;
  text-decoration: underline;
}
.stats-top-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.stats-user {
  font-size: 13px;
  color: var(--pine-deep);
  font-weight: 500;
}

.stats-body {
  flex: 1;
  padding: 24px;
  max-width: 800px;
  width: 100%;
  margin: 0 auto;
}
.stats-toolbar {
  margin-bottom: 20px;
}
.stats-filter {
  display: inline-flex;
  gap: 4px;
  background: var(--fog-dim);
  border-radius: 10px;
  padding: 4px;
}
.stats-filter button {
  padding: 8px 16px;
  border: none;
  background: transparent;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: rgba(42, 42, 36, 0.6);
  cursor: pointer;
  transition: all 0.15s;
}
.stats-filter button.active {
  background: #fff;
  color: var(--pine-deep);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.panel-empty {
  padding: 24px 20px;
  text-align: center;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 28px;
}
.summary-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px;
  text-align: center;
}
.summary-card b {
  display: block;
  font-family: 'Fraunces', serif;
  font-size: 30px;
  color: var(--pine-deep);
  margin-bottom: 6px;
}
.summary-card span {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
}

.stats-section {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 18px 20px;
  margin-bottom: 18px;
}
.stats-section h2 {
  font-size: 15px;
  margin-bottom: 4px;
}
.section-hint {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.5);
  margin-bottom: 12px;
}

.bar-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
.bar-row {
  display: grid;
  grid-template-columns: 130px 1fr 34px;
  align-items: center;
  gap: 10px;
}
.bar-label {
  font-size: 13px;
  color: var(--ink);
}
.bar-track {
  height: 10px;
  background: var(--fog-dim);
  border-radius: 999px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.3s ease;
}
.bar-fill-status {
  background: #f97316;
}
.bar-fill-type {
  background: #a8462b;
}
.bar-fill-team {
  background: #2563eb;
}
.bar-count {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
  text-align: right;
}

@media (max-width: 600px) {
  .stats-summary {
    grid-template-columns: 1fr;
  }
  .bar-row {
    grid-template-columns: 90px 1fr 28px;
  }
}
</style>
