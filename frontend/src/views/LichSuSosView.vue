<script setup lang="ts">
// F-UI-02 — lịch sử SOS cá nhân của victim (CLAUDE.md Mục 15.15). Danh sách lấy từ
// GET /api/sos/mine/history (mọi trạng thái, mới nhất trước, có phân trang); bấm "Xem chi
// tiết" mới tải timeline qua GET /api/sos/:id — không kéo timeline của mọi SOS ngay từ đầu.
import { ref, reactive, computed, onMounted } from 'vue'
import { layLichSuSosCuaToi, xemChiTietSos } from '@/services/sosService'
import { SOS_TYPE_LABEL, SOS_STATUS_LABEL } from '@/constants/sosLabels'
import SosTimeline from '@/components/sos/SosTimeline.vue'
import AnhHienTruong from '@/components/sos/AnhHienTruong.vue'
import type { SosLichSuItem, SosTimelineRow, SosStatus } from '@/types'

const SO_DONG_MOI_TRANG = 10

const danhSach = ref<SosLichSuItem[]>([])
const tong = ref(0)
const trangDaTai = ref(0)
const dangTai = ref(false)
const loi = ref(false)
const conDuLieu = computed(() => danhSach.value.length < tong.value)

// Chi tiết đã mở, theo id SOS — giữ lại để đóng/mở lại không phải tải lần nữa.
const moRong = ref<string | null>(null)
const chiTiet = reactive<Record<string, SosTimelineRow[]>>({})
const dangTaiChiTiet = ref<string | null>(null)

async function taiTrang(trang: number) {
  dangTai.value = true
  loi.value = false
  try {
    const kq = await layLichSuSosCuaToi(trang, SO_DONG_MOI_TRANG)
    danhSach.value = trang === 1 ? kq.items : [...danhSach.value, ...kq.items]
    tong.value = kq.total
    trangDaTai.value = trang
  } catch {
    // http.ts đã hiện toast lý do (mất mạng/401...) — ở đây chỉ cho thử lại.
    loi.value = true
  } finally {
    dangTai.value = false
  }
}

async function batTatChiTiet(id: string) {
  if (moRong.value === id) {
    moRong.value = null
    return
  }
  moRong.value = id
  if (chiTiet[id]) return
  dangTaiChiTiet.value = id
  try {
    const sos = await xemChiTietSos(id)
    chiTiet[id] = sos.timeline ?? []
  } catch {
    moRong.value = null
  } finally {
    dangTaiChiTiet.value = null
  }
}

function thoiGian(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function lopTrangThai(st: SosStatus): string {
  if (st === 'resolved') return 'is-xong'
  if (st === 'cancelled' || st === 'false_alarm') return 'is-huy'
  return 'is-dang-xu-ly'
}

onMounted(() => taiTrang(1))
</script>

<template>
  <div class="lich-su-page">
    <header class="lich-su-top">
      <RouterLink to="/map" class="lich-su-back" aria-label="Về bản đồ">←</RouterLink>
      <h1>Lịch sử SOS của tôi</h1>
    </header>

    <main class="lich-su-body">
      <p v-if="tong > 0" class="lich-su-dem">{{ tong }} yêu cầu</p>

      <div v-if="dangTai && danhSach.length === 0" class="lich-su-trong" aria-live="polite">Đang tải...</div>
      <div v-else-if="loi && danhSach.length === 0" class="lich-su-trong">
        <p>Không tải được lịch sử.</p>
        <button type="button" class="btn btn-ghost" data-test="thu-lai" @click="taiTrang(1)">Thử lại</button>
      </div>
      <div v-else-if="danhSach.length === 0" class="lich-su-trong">
        Bạn chưa gửi yêu cầu SOS nào.
      </div>

      <ul v-else class="lich-su-list">
        <li v-for="sos in danhSach" :key="sos.id" class="lich-su-the" data-test="the-sos">
          <div class="lich-su-the__dau">
            <strong>{{ SOS_TYPE_LABEL[sos.type] }}</strong>
            <span class="lich-su-trang-thai" :class="lopTrangThai(sos.status)">
              {{ SOS_STATUS_LABEL[sos.status] }}
            </span>
          </div>
          <p class="lich-su-meta">Gửi lúc {{ thoiGian(sos.created_at) }}</p>
          <p v-if="sos.resolved_at" class="lich-su-meta">Kết thúc lúc {{ thoiGian(sos.resolved_at) }}</p>
          <p v-if="sos.team_name" class="lich-su-meta">Đội phụ trách: {{ sos.team_name }}</p>
          <p v-if="sos.location_estimated" class="sos-location-warn">⚠️ Vị trí ước tính</p>
          <p v-if="sos.description" class="lich-su-mo-ta">{{ sos.description }}</p>

          <button
            type="button"
            class="lich-su-chi-tiet-btn"
            data-test="xem-chi-tiet"
            :aria-expanded="moRong === sos.id"
            :disabled="dangTaiChiTiet === sos.id"
            @click="batTatChiTiet(sos.id)"
          >
            {{ dangTaiChiTiet === sos.id ? 'Đang tải...' : moRong === sos.id ? 'Ẩn chi tiết' : 'Xem chi tiết' }}
          </button>

          <div v-if="moRong === sos.id && chiTiet[sos.id]" class="lich-su-chi-tiet">
            <AnhHienTruong v-if="sos.image_url" :sos-id="sos.id" />
            <SosTimeline :timeline="chiTiet[sos.id]" />
          </div>
        </li>
      </ul>

      <button
        v-if="conDuLieu"
        type="button"
        class="btn btn-ghost lich-su-tai-them"
        data-test="tai-them"
        :disabled="dangTai"
        @click="taiTrang(trangDaTai + 1)"
      >
        {{ dangTai ? 'Đang tải...' : 'Tải thêm' }}
      </button>
    </main>
  </div>
</template>

<style scoped>
.lich-su-page {
  min-height: 100vh;
  background: var(--fog);
  color: #2a2a24;
  color-scheme: light;
}
/* style.css có rule toàn cục `header { position: fixed }` (xem RescuerView.vue) — sticky để
   header vẫn chiếm chỗ, không che thẻ đầu tiên. */
.lich-su-top {
  position: sticky;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--line);
  background: rgba(245, 241, 230, 0.96);
}
.lich-su-top h1 {
  font-size: 18px;
  margin: 0;
}
.lich-su-back {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  color: var(--pine-deep);
  font-size: 20px;
  text-decoration: none;
}
.lich-su-body {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px 20px 40px;
}
.lich-su-dem {
  margin: 0 0 10px;
  font-size: 13px;
  color: rgba(42, 42, 36, 0.6);
}
.lich-su-trong {
  padding: 40px 20px;
  text-align: center;
  color: rgba(42, 42, 36, 0.6);
  font-size: 14px;
}
.lich-su-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.lich-su-the {
  padding: 14px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #ffffff;
}
.lich-su-the__dau {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.lich-su-trang-thai {
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.lich-su-trang-thai.is-dang-xu-ly {
  background: #fdecc8;
  color: #7a4a00;
}
.lich-su-trang-thai.is-xong {
  background: #dcefdc;
  color: #1d5b2a;
}
.lich-su-trang-thai.is-huy {
  background: #ececec;
  color: #555555;
}
.lich-su-meta {
  margin: 6px 0 0;
  font-size: 13px;
  color: rgba(42, 42, 36, 0.7);
}
.sos-location-warn {
  margin: 6px 0 0;
  font-size: 12px;
  font-weight: 600;
  color: #9a3412;
}
.lich-su-mo-ta {
  margin: 8px 0 0;
  font-size: 14px;
  white-space: pre-wrap;
}
.lich-su-chi-tiet-btn {
  margin-top: 10px;
  min-height: 40px;
  padding: 0 14px;
  border: 1.5px solid rgba(42, 42, 36, 0.35);
  border-radius: 9px;
  background: transparent;
  color: #2a2a24;
  font: 500 13px/1 'Inter', sans-serif;
  cursor: pointer;
}
.lich-su-chi-tiet-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}
.lich-su-chi-tiet-btn:focus-visible,
.lich-su-back:focus-visible,
.lich-su-tai-them:focus-visible {
  outline: 3px solid var(--pine-deep);
  outline-offset: 2px;
}
.lich-su-chi-tiet {
  margin-top: 10px;
}
/* Nền trang luôn sáng — giữ chữ tối cho nút viền kể cả khi bật dark mode (xem 15.13 mục 5). */
.lich-su-page .btn-ghost {
  color: #2a2a24;
  border: 1.5px solid rgba(42, 42, 36, 0.4);
}
.lich-su-tai-them {
  display: block;
  margin: 16px auto 0;
}
</style>
