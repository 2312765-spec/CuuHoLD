<script setup lang="ts">
// Bảng kiểm duyệt báo cáo cộng đồng cho commander (tab thứ 3 của Dashboard):
//  - "Chờ duyệt": hàng đợi việc cần làm. Báo cáo trùng điểm (cùng loại, ≤100 m) đã được server gộp
//    thành MỘT mục với "N người cùng báo"; mở mục ra xem ảnh của từng người rồi duyệt/từ chối cả nhóm.
//  - "Đã duyệt" / "Từ chối": lịch sử, có phân trang, kèm người duyệt, ghi chú và cảnh báo sinh ra.
// Danh sách chờ duyệt do Dashboard giữ (bản đồ cũng cần vẽ điểm "?" vàng); lịch sử thuộc riêng bảng này.

import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { HAZARD_TYPE_LABEL, HAZARD_SEVERITY_LABEL } from '@/constants/hazardLabels'
import {
  layBaoCaoDeKiemDuyet,
  taiAnhBaoCao,
  duyetBaoCao,
  tuChoiBaoCao
} from '@/services/hazardReportsService'
import type { Hazard, HazardReportAdmin, HazardSeverity, ReportStatus } from '@/types'

const props = defineProps<{
  pending: HazardReportAdmin[]
  loadingPending: boolean
  selectedId: string | null
  // Dashboard tăng số này mỗi khi có commander duyệt/từ chối (socket) → làm mới lịch sử đang xem.
  historyVersion: number
}>()

const emit = defineEmits<{
  'update:selectedId': [id: string | null]
  approved: [payload: { reportId: string; hazard: Hazard; mergedCount: number }]
  rejected: [payload: { reportId: string; mergedCount: number }]
  'need-refresh': []
}>()

const FILTERS: { key: ReportStatus; label: string }[] = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Từ chối' }
]
const PAGE_SIZE = 20

const filter = ref<ReportStatus>('pending')

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit'
  })
}

// ---------- Lịch sử (đã duyệt / từ chối) ----------
const history = ref<HazardReportAdmin[]>([])
const loadingHistory = ref(false)
const hasMore = ref(false)
const historyExpandedId = ref<string | null>(null)

async function taiLichSu(tuDau: boolean): Promise<void> {
  const trangThai = filter.value
  if (trangThai === 'pending') return
  loadingHistory.value = true
  try {
    const trang = await layBaoCaoDeKiemDuyet(trangThai, {
      limit: PAGE_SIZE,
      offset: tuDau ? 0 : history.value.length
    })
    // Người dùng đã chuyển sang bộ lọc khác trong lúc chờ → bỏ kết quả cũ, đừng ghi đè danh sách mới.
    if (filter.value !== trangThai) return
    history.value = tuDau ? trang : [...history.value, ...trang]
    hasMore.value = trang.length === PAGE_SIZE
  } catch {
    // Interceptor http.ts đã hiện toast lỗi mạng/server.
  } finally {
    if (filter.value === trangThai) loadingHistory.value = false
  }
}

watch(filter, () => {
  historyExpandedId.value = null
  history.value = []
  hasMore.value = false
  loadingHistory.value = false
  void taiLichSu(true)
})

watch(
  () => props.historyVersion,
  () => {
    if (filter.value !== 'pending') void taiLichSu(true)
  }
)

// ---------- Danh sách đang hiển thị + mục đang mở ----------
const items = computed(() => (filter.value === 'pending' ? props.pending : history.value))
const dangTai = computed(() => (filter.value === 'pending' ? props.loadingPending : loadingHistory.value))
const expandedId = computed(() =>
  filter.value === 'pending' ? props.selectedId : historyExpandedId.value
)
const expandedItem = computed(() => items.value.find((r) => r.id === expandedId.value) ?? null)

function moHoacDong(r: HazardReportAdmin): void {
  if (filter.value === 'pending') {
    emit('update:selectedId', props.selectedId === r.id ? null : r.id)
  } else {
    historyExpandedId.value = historyExpandedId.value === r.id ? null : r.id
  }
}

// ---------- Ảnh (cần JWT nên tải theo yêu cầu, lưu cache theo id báo cáo) ----------
const photos = ref<Record<string, string>>({})
const photoLoading = ref<Record<string, boolean>>({})

async function taiAnh(id: string): Promise<void> {
  if (photos.value[id] || photoLoading.value[id]) return
  photoLoading.value[id] = true
  try {
    photos.value[id] = await taiAnhBaoCao(id)
  } catch {
    // Interceptor http.ts đã hiện toast lỗi.
  } finally {
    photoLoading.value[id] = false
  }
}

interface MucAnh {
  id: string
  ten: string
  sdt: string
  luc: string
  moTa: string | null
  coAnh: boolean
}

// Báo cáo chính + các báo cáo đã gộp — mỗi người một ảnh để commander đối chiếu.
function nhomAnh(r: HazardReportAdmin): MucAnh[] {
  return [
    {
      id: r.id,
      ten: r.reporter_name,
      sdt: r.reporter_phone,
      luc: r.created_at,
      moTa: r.description,
      coAnh: r.has_image
    },
    ...r.duplicates.map((d) => ({
      id: d.id,
      ten: d.reporter_name,
      sdt: d.reporter_phone,
      luc: d.created_at,
      moTa: d.description,
      coAnh: d.has_image
    }))
  ]
}

// Bấm điểm "?" vàng trên bản đồ (Dashboard đặt selectedId) khi đang xem lịch sử → quay về "Chờ duyệt".
watch(
  () => props.selectedId,
  (id) => {
    if (id) filter.value = 'pending'
  }
)

// Theo dõi cả id lẫn SỐ báo cáo gộp: có người báo trùng đến lúc mục đang mở thì tải thêm ảnh của họ.
watch(
  [expandedId, () => expandedItem.value?.duplicates.length],
  () => {
    const r = expandedItem.value
    if (r) nhomAnh(r).filter((m) => m.coAnh).forEach((m) => void taiAnh(m.id))
  },
  { immediate: true }
)

onBeforeUnmount(() => {
  Object.values(photos.value).forEach((u) => URL.revokeObjectURL(u))
})

// ---------- Duyệt / từ chối (chỉ báo cáo chờ duyệt) ----------
const reviewSeverity = ref<HazardSeverity>('blocked')
const reviewRadius = ref(200)
const reviewNote = ref('')
const reviewingId = ref<string | null>(null)

// Chỉ đặt lại form khi ĐỔI mục đang mở — không đặt lại mỗi lần danh sách làm mới theo socket,
// nếu không ghi chú commander đang gõ dở sẽ mất mỗi khi có báo cáo mới tới.
watch(expandedId, () => {
  reviewSeverity.value = 'blocked'
  reviewRadius.value = 200
  reviewNote.value = ''
})

async function duyet(r: HazardReportAdmin): Promise<void> {
  reviewingId.value = r.id
  try {
    const res = await duyetBaoCao(r.id, {
      severity: reviewSeverity.value,
      radiusMeters: reviewRadius.value,
      note: reviewNote.value.trim() || undefined
    })
    emit('approved', { reportId: r.id, hazard: res.hazard, mergedCount: res.merged_count })
  } catch {
    // Interceptor http.ts đã hiện toast lỗi (VD: người khác đã xử lý rồi) → làm mới hàng đợi.
    emit('need-refresh')
  } finally {
    reviewingId.value = null
  }
}

async function tuChoi(r: HazardReportAdmin): Promise<void> {
  reviewingId.value = r.id
  try {
    const res = await tuChoiBaoCao(r.id, reviewNote.value.trim() || undefined)
    emit('rejected', { reportId: r.id, mergedCount: res.merged_count })
  } catch {
    emit('need-refresh')
  } finally {
    reviewingId.value = null
  }
}

const emptyText = computed(() => {
  if (filter.value === 'pending') return 'Không có báo cáo nào đang chờ duyệt.'
  if (filter.value === 'approved') return 'Chưa có báo cáo nào được duyệt.'
  return 'Chưa có báo cáo nào bị từ chối.'
})
</script>

<template>
  <div class="mod">
    <div class="mod-filter" role="tablist" aria-label="Lọc báo cáo">
      <button
        v-for="f in FILTERS"
        :key="f.key"
        type="button"
        role="tab"
        :aria-selected="filter === f.key"
        class="mod-filter-btn"
        :class="{ active: filter === f.key }"
        @click="filter = f.key"
      >
        {{ f.label }}<template v-if="f.key === 'pending'"> ({{ pending.length }})</template>
      </button>
    </div>

    <div class="mod-hint">
      <template v-if="filter === 'pending'">
        Báo cáo từ người dân/tình nguyện viên, ảnh chụp trực tiếp tại hiện trường. Chỉ khi bạn
        <b>duyệt</b> thì cảnh báo mới hiện lên bản đồ chung (đỏ = chặn đường, vàng = cẩn trọng).
        Báo cáo trùng điểm đã được gộp thành một mục — duyệt hay từ chối sẽ áp dụng cho cả nhóm.
      </template>
      <template v-else>
        Lịch sử xử lý, mới nhất trước. Bấm vào một mục để xem ảnh và ghi chú.
      </template>
    </div>

    <div v-if="dangTai && items.length === 0" class="panel-empty">Đang tải...</div>
    <div v-else-if="items.length === 0" class="panel-empty">{{ emptyText }}</div>
    <ul v-else class="mod-list">
      <li
        v-for="r in items"
        :key="r.id"
        class="mod-item"
        :class="[`mod-item--${r.status}`, { active: r.id === expandedId }]"
      >
        <div class="mod-head" @click="moHoacDong(r)">
          <div class="mod-top">
            <span class="mod-badge">
              {{ HAZARD_TYPE_LABEL[r.type] }}
              <span v-if="r.reporter_count > 1" class="chip chip--group">
                {{ r.reporter_count }} người cùng báo
              </span>
            </span>
            <span class="mod-time">{{ formatTime(r.created_at) }}</span>
          </div>
          <div class="mod-name">{{ r.reporter_name }} · {{ r.reporter_phone }}</div>
          <p v-if="r.description" class="mod-desc">{{ r.description }}</p>
          <div class="mod-meta">
            Xã/phường {{ r.ward_code ?? '—' }}<template v-if="r.accuracy_m != null"> · GPS ±{{ r.accuracy_m }} m</template>
            <template v-if="r.has_image"> · có ảnh</template>
          </div>
          <p v-if="r.location_estimated" class="warn">Vị trí kém chính xác</p>
          <p v-if="r.nearby_hazard" class="warn warn--hazard">
            Đã có cảnh báo {{ HAZARD_TYPE_LABEL[r.nearby_hazard.type].toLowerCase() }}
            ({{ HAZARD_SEVERITY_LABEL[r.nearby_hazard.severity] }}) đang hoạt động cách
            {{ r.nearby_hazard.distance_m }} m — cân nhắc trước khi tạo thêm.
          </p>

          <!-- Lịch sử: kết quả xử lý -->
          <div v-if="r.status !== 'pending'" class="mod-result">
            <span class="chip" :class="r.status === 'approved' ? 'chip--ok' : 'chip--no'">
              {{ r.status === 'approved' ? 'Đã duyệt' : 'Từ chối' }}
            </span>
            <span
              v-if="r.status === 'approved' && r.hazard_severity"
              class="chip"
              :class="r.hazard_severity === 'blocked' ? 'chip--red' : 'chip--yellow'"
            >
              Cảnh báo {{ HAZARD_SEVERITY_LABEL[r.hazard_severity] }}{{ r.hazard_is_active === false ? ' · đã gỡ' : ' · đang hoạt động' }}
            </span>
            <span v-if="r.duplicate_count > 0" class="chip chip--group">gộp {{ r.duplicate_count }} báo cáo</span>
            <div class="mod-meta">
              <template v-if="r.reviewed_by_name">Bởi {{ r.reviewed_by_name }}</template>
              <template v-if="r.reviewed_at"> · {{ formatTime(r.reviewed_at) }}</template>
            </div>
            <p v-if="r.review_note" class="mod-meta">Ghi chú: {{ r.review_note }}</p>
          </div>
        </div>

        <div v-if="r.id === expandedId" class="mod-body">
          <div class="mod-photos">
            <figure v-for="m in nhomAnh(r)" :key="m.id" class="mod-photo">
              <img v-if="photos[m.id]" :src="photos[m.id]" :alt="`Ảnh hiện trường do ${m.ten} chụp`" />
              <div v-else class="mod-photo-wait">
                <template v-if="!m.coAnh">Không kèm ảnh</template>
                <template v-else-if="photoLoading[m.id]">Đang tải ảnh...</template>
                <template v-else>
                  Chưa tải được ảnh.
                  <button type="button" class="link" @click="taiAnh(m.id)">Thử lại</button>
                </template>
              </div>
              <figcaption>
                {{ m.ten }} · {{ m.sdt }} · {{ formatTime(m.luc) }}<template v-if="m.moTa"> — {{ m.moTa }}</template>
              </figcaption>
            </figure>
          </div>

          <template v-if="r.status === 'pending'">
            <div class="review-severity" role="radiogroup" aria-label="Mức độ khi duyệt">
              <label :class="{ on: reviewSeverity === 'blocked' }">
                <input v-model="reviewSeverity" type="radio" value="blocked" />
                <span class="chip chip--red">Đỏ</span> Chặn đường (tuyến đi sẽ né)
              </label>
              <label :class="{ on: reviewSeverity === 'caution' }">
                <input v-model="reviewSeverity" type="radio" value="caution" />
                <span class="chip chip--yellow">Vàng</span> Cẩn trọng (chỉ cảnh báo)
              </label>
            </div>
            <div class="field">
              <label :for="`rv-r-${r.id}`">Bán kính vùng ảnh hưởng (mét)</label>
              <input :id="`rv-r-${r.id}`" v-model.number="reviewRadius" type="number" min="10" max="5000" step="10" />
            </div>
            <div class="field">
              <label :for="`rv-n-${r.id}`">Ghi chú (tuỳ chọn)</label>
              <input :id="`rv-n-${r.id}`" v-model="reviewNote" type="text" maxlength="500" placeholder="VD: đã gọi xác minh với trưởng thôn" />
            </div>
            <div class="mod-actions">
              <button class="btn btn-primary btn-sm" :disabled="reviewingId === r.id" @click="duyet(r)">
                {{ reviewingId === r.id ? 'Đang xử lý...' : r.duplicates.length > 0 ? `Duyệt cả nhóm (${r.reporter_count} người) & đăng lên bản đồ` : 'Duyệt & đăng lên bản đồ' }}
              </button>
              <button class="btn btn-ghost btn-sm" :disabled="reviewingId === r.id" @click="tuChoi(r)">
                {{ r.duplicates.length > 0 ? 'Từ chối cả nhóm' : 'Từ chối' }}
              </button>
            </div>
          </template>
        </div>
      </li>
    </ul>

    <div v-if="filter !== 'pending' && hasMore" class="mod-more">
      <button class="btn btn-ghost btn-sm" :disabled="loadingHistory" @click="taiLichSu(false)">
        {{ loadingHistory ? 'Đang tải...' : 'Tải thêm' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.panel-empty {
  padding: 24px 20px;
  color: rgba(42, 42, 36, 0.55);
  font-size: 13px;
}
.mod-filter {
  display: flex;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}
.mod-filter-btn {
  padding: 6px 12px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: #fff;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.7);
  cursor: pointer;
}
.mod-filter-btn.active {
  background: var(--pine-deep);
  border-color: var(--pine-deep);
  color: var(--fog);
}
.mod-hint {
  padding: 12px 20px;
  font-size: 12px;
  line-height: 1.5;
  color: rgba(42, 42, 36, 0.6);
  background: var(--fog-dim);
  border-bottom: 1px solid var(--line);
}
.mod-list {
  list-style: none;
}
.mod-item {
  border-bottom: 1px solid var(--line);
  border-left: 4px solid #eab308; /* chờ duyệt */
}
.mod-item--approved {
  border-left-color: #16a34a;
}
.mod-item--rejected {
  border-left-color: #9ca3af;
}
.mod-item.active {
  background: #fffbeb;
}
.mod-item--approved.active,
.mod-item--rejected.active {
  background: var(--fog-dim);
}
.mod-head {
  padding: 14px 20px;
  cursor: pointer;
}
.mod-top {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 6px;
}
.mod-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--pine-deep);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.mod-time {
  font-size: 11px;
  color: rgba(42, 42, 36, 0.6);
  white-space: nowrap;
}
.mod-name {
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 2px;
}
.mod-desc {
  font-size: 13px;
  margin-bottom: 4px;
}
.mod-meta {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
}
.warn {
  display: inline-block;
  margin: 4px 0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  color: #b45309;
  background: #fef3c7;
}
.warn--hazard {
  display: block;
  color: #991b1b;
  background: #fee2e2;
}
.mod-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
}
.mod-result .mod-meta {
  flex-basis: 100%;
}
.chip {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.02em;
  text-transform: none;
}
.chip--group {
  background: #e0e7ff;
  color: #3730a3;
  margin-left: 6px;
}
.mod-result .chip--group {
  margin-left: 0;
}
.chip--ok {
  background: #dcfce7;
  color: #166534;
}
.chip--no {
  background: #f3f4f6;
  color: #4b5563;
}
.chip--red {
  background: #fee2e2;
  color: #991b1b;
}
.chip--yellow {
  background: #fef9c3;
  color: #854d0e;
}
.mod-body {
  padding: 0 20px 16px;
}
.mod-photos {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 12px;
}
.mod-photo img {
  display: block;
  width: 100%;
  max-height: 280px;
  object-fit: contain;
  background: #f3f4f6;
  border-radius: 8px;
}
.mod-photo-wait {
  padding: 22px 10px;
  text-align: center;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
  background: #f3f4f6;
  border-radius: 8px;
}
.link {
  border: none;
  background: none;
  padding: 0;
  color: var(--pine-deep);
  text-decoration: underline;
  cursor: pointer;
  font: inherit;
}
.mod-photo figcaption {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.65);
}
.review-severity {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
}
.review-severity label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
}
.review-severity label.on {
  border-color: var(--pine-deep);
  background: var(--fog-dim);
}
.field {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field label {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.65);
}
.field input {
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
}
.mod-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.btn-sm {
  padding: 6px 12px;
  font-size: 12px;
}
.mod-more {
  padding: 14px 20px;
  text-align: center;
}
</style>
