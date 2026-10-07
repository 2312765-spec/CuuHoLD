<script setup lang="ts">
// Báo cáo cộng đồng (crowdsourcing) về sạt lở / chặn đường — dành cho người dân và tình nguyện
// viên dùng điện thoại tại hiện trường:
//  - Tự lấy GPS bằng Geolocation API (không cho tự gõ toạ độ) và lấy LẠI ngay lúc chụp ảnh, để
//    toạ độ gắn với thời điểm chụp chứ không phải lúc mở trang.
//  - Ảnh hiện trường BẮT BUỘC và chỉ chụp trực tiếp bằng camera (components/report/CameraCapture) —
//    không cho chọn ảnh có sẵn, để tăng độ xác thực.
//  - Báo cáo vào trạng thái "Chờ duyệt" và báo ngay cho quản trị viên; quản trị viên xác minh xong
//    mới hiện lên bản đồ chung. Báo cáo trùng điểm được gộp, người báo được cho biết.

import { ref, shallowRef, computed, onMounted } from 'vue'
import '@/assets/map-style.css'
import CameraCapture from '@/components/report/CameraCapture.vue'
import { HAZARD_TYPES, HAZARD_TYPE_LABEL, REPORT_STATUS_LABEL } from '@/constants/hazardLabels'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { layViTriChiTiet } from '@/utils/geolocation'
import type { KetQuaViTriChiTiet } from '@/utils/geolocation'
import { guiBaoCaoCongDong, layBaoCaoCuaToi } from '@/services/hazardReportsService'
import type { HazardReport, HazardType } from '@/types'

const authStore = useAuthStore()
const toastStore = useToastStore()

// Quay lại đúng khu vực theo vai trò — mỗi vai trò có "trang chủ" riêng.
const trangQuayLai = computed(() => {
  if (authStore.role === 'commander') return '/dashboard'
  if (authStore.role === 'rescuer') return '/rescuer'
  return '/map'
})

// ---------- Vị trí: tự động, KHÔNG cho nhập tay ----------
const viTri = ref<KetQuaViTriChiTiet | null>(null)
const dangLayViTri = ref(false)

async function layViTri(): Promise<void> {
  dangLayViTri.value = true
  try {
    viTri.value = await layViTriChiTiet(navigator.geolocation)
  } finally {
    dangLayViTri.value = false
  }
}

// Lấy lại vị trí ngay khi vừa chụp ảnh. Lần này nếu GPS thất bại thì GIỮ lần lấy trước (còn mới,
// người dùng đang đứng tại hiện trường) — không ghi đè bằng toạ độ giả tâm tỉnh mà hàm trả về.
async function lamMoiViTriKhiChup(): Promise<void> {
  dangLayViTri.value = true
  try {
    const moi = await layViTriChiTiet(navigator.geolocation)
    if (moi.doChinhXacM !== null) viTri.value = moi
  } finally {
    dangLayViTri.value = false
  }
}

// GPS thất bại (doChinhXacM = null) nghĩa là toạ độ trong viTri là toạ độ GIẢ tâm tỉnh — gửi đi sẽ
// đặt cảnh báo sai chỗ trên bản đồ chung, nên CHẶN gửi (khác SOS: SOS khẩn cấp vẫn phải gửi được).
const coViTriThat = computed(() => viTri.value !== null && viTri.value.doChinhXacM !== null)
const viTriKem = computed(() => coViTriThat.value && (viTri.value?.uocLuong ?? false))

// ---------- Form ----------
const loai = ref<HazardType>('landslide')
const moTa = ref('')
// shallowRef (KHÔNG phải ref): ref() bọc Blob thành Proxy reactive; FormData.append không nhận ra Proxy là
// Blob nên biến nó thành chuỗi "[object Blob]" → server báo "property image should not exist".
const anh = shallowRef<Blob | null>(null)
const camera = ref<InstanceType<typeof CameraCapture> | null>(null)
const dangGui = ref(false)

async function khiCoAnh(blob: Blob | null): Promise<void> {
  anh.value = blob
  if (blob) await lamMoiViTriKhiChup()
}

// Phải có vị trí thật VÀ ảnh chụp thì mới gửi được.
const coTheGui = computed(
  () => coViTriThat.value && anh.value !== null && !dangGui.value && !dangLayViTri.value
)

async function gui(): Promise<void> {
  if (!viTri.value || !coViTriThat.value || !anh.value) return
  dangGui.value = true
  try {
    const kq = await guiBaoCaoCongDong({
      type: loai.value,
      description: moTa.value.trim() || undefined,
      lat: viTri.value.lat,
      lng: viTri.value.lng,
      accuracyMeters: viTri.value.doChinhXacM,
      locationEstimated: viTri.value.uocLuong,
      image: anh.value
    })
    toastStore.showToast(
      kq.merged
        ? `Đã có người báo cáo điểm này — báo cáo của bạn được gộp (${kq.group_reporter_count} người cùng báo). Quản trị viên sẽ xác minh.`
        : 'Đã gửi báo cáo. Quản trị viên đã được thông báo và sẽ xác minh trước khi hiện lên bản đồ.'
    )
    if (kq.nearby_hazard) {
      toastStore.showToast(
        `Lưu ý: khu vực này đã có cảnh báo ${HAZARD_TYPE_LABEL[kq.nearby_hazard.type].toLowerCase()} đang hoạt động (cách ${kq.nearby_hazard.distance_m} m).`
      )
    }
    moTa.value = ''
    anh.value = null
    camera.value?.reset()
    await taiBaoCaoCuaToi()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: ngoài tỉnh, đã báo điểm này, quá 5 báo cáo chờ duyệt).
  } finally {
    dangGui.value = false
  }
}

// ---------- Báo cáo của tôi ----------
const baoCaoCuaToi = ref<HazardReport[]>([])
async function taiBaoCaoCuaToi(): Promise<void> {
  try {
    baoCaoCuaToi.value = await layBaoCaoCuaToi()
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
}

onMounted(() => {
  void layViTri()
  void taiBaoCaoCuaToi()
})
</script>

<template>
  <div class="report-page">
    <header class="report-top">
      <RouterLink :to="trangQuayLai" class="report-back">← Quay lại</RouterLink>
      <h1>Báo cáo sạt lở / chặn đường</h1>
    </header>

    <main class="report-body">
      <p class="report-intro">
        Bạn thấy đường bị sạt lở, cây đổ hay ngập? Chụp ảnh tại chỗ và gửi ngay — quản trị viên sẽ
        được báo tức thì, xác minh rồi mới hiện lên bản đồ chung.
      </p>

      <!-- 1. Vị trí -->
      <section class="report-card">
        <h2>1. Vị trí hiện tại</h2>
        <p v-if="dangLayViTri" class="gps gps--wait">Đang xác định vị trí GPS chính xác...</p>
        <template v-else-if="viTri && coViTriThat">
          <p class="gps" :class="viTriKem ? 'gps--warn' : 'gps--ok'">
            {{ viTri.lat.toFixed(5) }}, {{ viTri.lng.toFixed(5) }}
            <span class="gps-acc">(sai số ≈ {{ viTri.doChinhXacM }} m)</span>
          </p>
          <p v-if="viTriKem" class="note note--warn">
            GPS đang kém. Hãy ra chỗ thoáng và bấm "Lấy lại vị trí" để báo cáo chính xác hơn.
          </p>
        </template>
        <p v-else class="note note--bad">
          Không lấy được vị trí GPS. Hãy bật định vị và cho phép trình duyệt truy cập vị trí, rồi thử
          lại. Không thể gửi báo cáo khi chưa có vị trí thật.
        </p>
        <button class="btn btn-ghost btn-sm" :disabled="dangLayViTri" @click="layViTri">
          Lấy lại vị trí
        </button>
      </section>

      <!-- 2. Loại -->
      <section class="report-card">
        <h2>2. Tình trạng</h2>
        <div class="chips" role="radiogroup" aria-label="Loại tình trạng">
          <button
            v-for="t in HAZARD_TYPES"
            :key="t"
            type="button"
            class="chip"
            :class="{ active: loai === t }"
            role="radio"
            :aria-checked="loai === t"
            @click="loai = t"
          >
            {{ HAZARD_TYPE_LABEL[t] }}
          </button>
        </div>
        <label class="field-label" for="mo-ta">Mô tả (không bắt buộc)</label>
        <textarea
          id="mo-ta"
          v-model="moTa"
          rows="3"
          maxlength="500"
          placeholder="VD: Đá lăn xuống chắn nửa đường, xe máy còn đi được"
        ></textarea>
      </section>

      <!-- 3. Ảnh chụp trực tiếp (bắt buộc) -->
      <section class="report-card">
        <h2>3. Ảnh hiện trường (chụp trực tiếp)</h2>
        <p class="note">
          Để báo cáo đáng tin cậy, ảnh phải được <b>chụp trực tiếp bằng camera</b> tại hiện trường —
          không chọn ảnh có sẵn trong máy. Bạn cần cho phép trình duyệt dùng camera. Vị trí sẽ được
          cập nhật lại ngay khi bạn chụp.
        </p>
        <CameraCapture ref="camera" @update:photo="khiCoAnh" />
      </section>

      <button class="btn btn-primary report-submit" :disabled="!coTheGui" @click="gui">
        {{ dangGui ? 'Đang gửi...' : 'Gửi báo cáo' }}
      </button>
      <p v-if="!coTheGui && !dangGui && coViTriThat && !anh" class="note submit-hint">
        Chụp ảnh hiện trường để gửi báo cáo.
      </p>

      <!-- Báo cáo của tôi -->
      <section v-if="baoCaoCuaToi.length > 0" class="report-card mine">
        <h2>Báo cáo của tôi</h2>
        <ul class="mine-list">
          <li v-for="r in baoCaoCuaToi" :key="r.id" class="mine-item">
            <div class="mine-top">
              <b>{{ HAZARD_TYPE_LABEL[r.type] }}</b>
              <span class="badge" :class="`badge--${r.status}`">{{ REPORT_STATUS_LABEL[r.status] }}</span>
            </div>
            <p v-if="r.description" class="mine-desc">{{ r.description }}</p>
            <p class="mine-meta">{{ formatTime(r.created_at) }}<template v-if="r.has_image"> · có ảnh</template></p>
            <p v-if="r.duplicate_of" class="mine-meta">
              Đã gộp với báo cáo của người khác ở cùng điểm — kết quả duyệt áp dụng chung.
            </p>
            <p v-if="r.review_note" class="mine-meta">Ghi chú của quản trị viên: {{ r.review_note }}</p>
          </li>
        </ul>
      </section>
    </main>

    <div class="toast" :class="{ show: toastStore.visible }">{{ toastStore.message }}</div>
  </div>
</template>

<style scoped>
.report-page {
  min-height: 100vh;
  background: var(--fog);
}
.report-top {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  background: rgba(245, 241, 230, 0.96);
  border-bottom: 1px solid var(--line);
}
.report-top h1 {
  font-size: 16px;
}
.report-back {
  font-size: 13px;
  color: var(--pine-deep);
  text-decoration: none;
  white-space: nowrap;
}
.report-body {
  max-width: 560px;
  margin: 0 auto;
  padding: 16px 16px 48px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.report-intro {
  font-size: 13px;
  color: rgba(42, 42, 36, 0.7);
}
.report-card {
  background: #fff;
  border: 1px solid var(--line);
  border-radius: 12px;
  padding: 14px 16px;
}
.report-card h2 {
  font-size: 14px;
  margin-bottom: 10px;
}
.gps {
  font-family: ui-monospace, monospace;
  font-size: 14px;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 8px;
}
.gps--ok {
  background: #ecfdf5;
  color: #166534;
}
.gps--warn {
  background: #fef3c7;
  color: #92400e;
}
.gps--wait {
  background: var(--fog-dim);
  font-family: inherit;
}
.gps-acc {
  font-family: inherit;
  font-size: 12px;
  opacity: 0.8;
}
.note {
  font-size: 12px;
  line-height: 1.5;
  color: rgba(42, 42, 36, 0.6);
  margin-bottom: 8px;
}
.note--warn {
  color: #92400e;
}
.note--bad {
  color: #b91c1c;
}
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.chip {
  padding: 10px 16px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
  min-height: 44px; /* chạm bằng ngón tay */
}
.chip.active {
  background: var(--pine-deep);
  color: var(--fog);
  border-color: var(--pine-deep);
}
.field-label {
  display: block;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.65);
  margin-bottom: 4px;
}
textarea {
  width: 100%;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font: inherit;
  font-size: 14px;
  resize: vertical;
}
.btn-sm {
  padding: 10px 14px;
  font-size: 13px;
}
.report-submit {
  width: 100%;
  justify-content: center;
  min-height: 48px;
}
.report-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.submit-hint {
  text-align: center;
  margin: -6px 0 0;
}
.mine-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.mine-item {
  border-bottom: 1px solid var(--line);
  padding-bottom: 10px;
}
.mine-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 14px;
}
.mine-desc {
  font-size: 13px;
  margin-top: 4px;
}
.mine-meta {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.55);
  margin-top: 2px;
}
.badge {
  font-size: 11px;
  padding: 3px 8px;
  border-radius: 999px;
  font-weight: 600;
}
.badge--pending {
  background: #fef3c7;
  color: #92400e;
}
.badge--approved {
  background: #dcfce7;
  color: #166534;
}
.badge--rejected {
  background: #fee2e2;
  color: #991b1b;
}
</style>
