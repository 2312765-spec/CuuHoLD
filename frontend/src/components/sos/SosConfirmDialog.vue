<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { SosType } from '@/types'

// baoHo: đang báo SOS hộ người khác (F-SOS-07) — vị trí gửi đi là vị trí đã ghim trên bản
// đồ, không phải GPS của máy này, nên câu mô tả phải nói đúng như vậy.
const props = defineProps<{ isOpen: boolean; baoHo?: boolean }>()
const emit = defineEmits<{
  cancel: []
  confirm: [payload: { type: SosType; description: string; anh?: Blob }]
}>()

// 10 loại sự cố đúng theo api-contract (enum SosType).
const LOAI_SU_CO: { value: SosType; label: string }[] = [
  { value: 'flood', label: 'Lũ lụt' },
  { value: 'landslide', label: 'Sạt lở' },
  { value: 'accident', label: 'Tai nạn' },
  { value: 'medical', label: 'Y tế khẩn cấp' },
  { value: 'fire', label: 'Cháy' },
  { value: 'lost', label: 'Mất tích / lạc' },
  { value: 'drowning', label: 'Đuối nước' },
  { value: 'agricultural', label: 'Nông nghiệp' },
  { value: 'adventure', label: 'Tai nạn dã ngoại' },
  { value: 'other', label: 'Khác' }
]

const loaiDaChon = ref<SosType>('medical')
const moTa = ref('')
// Ảnh đã nén (Blob) để gửi SAU khi SOS tạo xong + URL tạm để xem trước trong dialog.
const anhBlob = ref<Blob | null>(null)
const anhXemTruoc = ref('')
const dangXuLyAnh = ref(false)
const inputAnh = ref<HTMLInputElement | null>(null)
const demNguoc = ref(5)
const dangDemNguoc = ref(false)
let timer: ReturnType<typeof setInterval> | undefined

// Đếm ngược 5s trước khi cho gửi — người dùng có thời gian huỷ nếu bấm nhầm,
// nhưng KHÔNG tự gửi khi hết giờ; hết đếm ngược chỉ mở khoá nút "Gửi ngay".
function batDauDemNguoc() {
  demNguoc.value = 5
  dangDemNguoc.value = true
  clearInterval(timer)
  timer = setInterval(() => {
    demNguoc.value--
    if (demNguoc.value <= 0) {
      clearInterval(timer)
      dangDemNguoc.value = false
    }
  }, 1000)
}

function dungDemNguoc() {
  clearInterval(timer)
  dangDemNguoc.value = false
}

// Mở dialog → reset và bắt đầu đếm ngược lại từ đầu.
watch(
  () => props.isOpen,
  (open) => {
    if (open) {
      moTa.value = ''
      loaiDaChon.value = 'medical'
      xoaAnh()
      batDauDemNguoc()
    } else {
      dungDemNguoc()
    }
  }
)

// F-SOS-06 — nén ảnh phía client thành JPEG (cạnh dài tối đa 1280px, chất lượng 0.7, thường
// 150–400 KB). Ảnh KHÔNG đi trong POST /api/sos nữa: trước đây nhúng data-URI base64 vào
// imageUrl vượt giới hạn body 100 KB của backend + VARCHAR(500) của SRS → mất CẢ tín hiệu SOS.
// Giờ MapView gửi SOS trước, rồi mới gửi ảnh riêng qua POST /api/sos/:id/image
// (CLAUDE.md Mục 15.14).
function taiAnh(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load fail')) }
    img.src = url
  })
}
async function nenAnh(file: File): Promise<Blob | null> {
  const img = await taiAnh(file)
  const MAX = 1280
  let w = img.width, h = img.height
  if (w > MAX || h > MAX) {
    const tyLe = Math.min(MAX / w, MAX / h)
    w = Math.round(w * tyLe); h = Math.round(h * tyLe)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.7))
}
async function chonAnh(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  dangXuLyAnh.value = true
  try {
    const blob = await nenAnh(file)
    xoaAnh()
    if (blob) {
      anhBlob.value = blob
      anhXemTruoc.value = URL.createObjectURL(blob)
    }
  } catch {
    xoaAnh()
  } finally {
    dangXuLyAnh.value = false
    input.value = ''
  }
}
function xoaAnh() {
  if (anhXemTruoc.value) URL.revokeObjectURL(anhXemTruoc.value)
  anhXemTruoc.value = ''
  anhBlob.value = null
}

function huy() {
  emit('cancel')
}

// Esc để đóng khi lỡ bấm nhầm nút SOS (bàn phím / máy tính). Chỉ nghe lúc dialog đang mở.
function onPhim(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.isOpen) huy()
}
window.addEventListener('keydown', onPhim)
function guiNgay() {
  dungDemNguoc()
  emit('confirm', { type: loaiDaChon.value, description: moTa.value, anh: anhBlob.value ?? undefined })
}

onUnmounted(() => {
  clearInterval(timer)
  xoaAnh()
  window.removeEventListener('keydown', onPhim)
})
</script>

<template>
  <div class="sos-dialog-overlay" :class="{ open: isOpen }">
    <div class="sos-dialog-card" role="dialog" aria-modal="true" aria-labelledby="sos-dialog-title">
      <!-- Nút đóng luôn thấy rõ ở góc trên — lỡ bấm nhầm nút SOS thì thoát ngay, không gửi gì. -->
      <button type="button" class="sos-dialog-close" aria-label="Đóng, không gửi SOS" @click="huy">✕</button>
      <h3 id="sos-dialog-title">{{ baoHo ? 'Báo SOS hộ người khác' : 'Xác nhận gửi tín hiệu cứu trợ' }}</h3>
      <p class="sos-dialog-sub">
        {{ baoHo
          ? 'Vị trí bạn vừa ghim trên bản đồ sẽ được gửi tới trung tâm điều phối.'
          : 'Vị trí hiện tại của bạn sẽ được gửi tới trung tâm điều phối.' }}
      </p>

      <label>Loại tình huống
        <select v-model="loaiDaChon">
          <option v-for="l in LOAI_SU_CO" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </label>

      <label>Mô tả (không bắt buộc)
        <textarea
          v-model="moTa"
          rows="2"
          :placeholder="baoHo ? 'Tên, SĐT người gặp nạn (nếu biết), tình trạng, dấu hiệu nhận biết...' : 'Số người, tình trạng, dấu hiệu nhận biết...'"
        ></textarea>
      </label>

      <div class="sos-anh-field">
        <span class="sos-anh-title">Ảnh hiện trường (không bắt buộc)</span>
        <input ref="inputAnh" type="file" accept="image/*" capture="environment" class="sos-anh-input" @change="chonAnh" />
        <div v-if="anhXemTruoc" class="sos-anh-preview-wrap">
          <img :src="anhXemTruoc" class="sos-anh-preview" alt="Ảnh đính kèm" />
          <button type="button" class="sos-anh-xoa" @click="xoaAnh">✕ Xoá ảnh</button>
        </div>
        <button v-else type="button" class="sos-anh-them" :disabled="dangXuLyAnh" @click="inputAnh?.click()">
          {{ dangXuLyAnh ? 'Đang xử lý ảnh...' : '📷 Chụp / chọn ảnh' }}
        </button>
      </div>

      <div class="sos-dialog-actions">
        <button type="button" class="btn btn-ghost sos-cancel-btn" @click="huy">Huỷ</button>
        <button type="button" class="btn sos-confirm-btn" @click="guiNgay">
          {{ dangDemNguoc ? `Gửi ngay (${demNguoc}s)` : 'Gửi ngay' }}
        </button>
      </div>
      <p class="sos-dialog-hint">
        {{ dangDemNguoc ? 'Kiểm tra thông tin trong lúc đếm ngược, hoặc bấm Gửi ngay.' : 'Sẵn sàng gửi.' }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.sos-dialog-overlay{
  position:fixed; inset:0; z-index:2500; background:rgba(20,39,32,0.5);
  display:none; align-items:center; justify-content:center; padding:20px;
}
.sos-dialog-overlay.open{ display:flex; }
.sos-dialog-card{
  position:relative;
  background:var(--fog); border-radius:16px; padding:26px; width:100%; max-width:400px; color-scheme:light;
  box-shadow:0 24px 60px rgba(0,0,0,0.3);
}
.sos-dialog-close{
  position:absolute; top:10px; right:10px; width:44px; height:44px; border:0; border-radius:50%;
  background:transparent; color:#2a2a24; font-size:18px; cursor:pointer;
}
.sos-dialog-close:hover{ background:rgba(42,42,36,0.08); }
.sos-dialog-close:focus-visible, .sos-cancel-btn:focus-visible{ outline:3px solid var(--pine-deep); outline-offset:2px; }
/* Card luôn nền sáng (color-scheme:light) nên nút Huỷ phải giữ chữ tối — nếu không, dark mode
   của style.css đổi .btn-ghost sang chữ kem sáng và nút gần như biến mất trên nền kem. */
.sos-dialog-card .sos-cancel-btn{ color:#2a2a24; border:1.5px solid rgba(42,42,36,0.4); background:transparent; }
.sos-dialog-card .sos-cancel-btn:hover{ border-color:#2a2a24; }
.sos-dialog-card h3{ padding-right:40px; }
.sos-dialog-card h3{ font-family:'Fraunces',serif; font-size:19px; color:var(--pine-deep); margin-bottom:6px; }
.sos-dialog-sub{ font-size:13px; color:rgba(42,42,36,0.65); margin-bottom:18px; }
.sos-dialog-card label{ display:block; font-size:13px; color:var(--ink); margin-bottom:14px; }
.sos-dialog-card select, .sos-dialog-card textarea{
  display:block; width:100%; margin-top:6px; padding:11px 13px;
  background:#fff; color:#2a2a24; color-scheme:light;
  border:1px solid var(--line); border-radius:9px; font-family:'Inter',sans-serif; font-size:14px;
  transition:border-color .15s ease, box-shadow .15s ease;
}
.sos-dialog-card select:focus, .sos-dialog-card textarea:focus{
  outline:none; border-color:var(--pine-deep); box-shadow:0 0 0 3px rgba(31,61,46,0.13);
}
.sos-dialog-card textarea{ resize:vertical; min-height:64px; }
.sos-dialog-card option{ color:#2a2a24; background:#fff; }
.sos-anh-field{ display:block; margin-bottom:14px; }
.sos-anh-title{ display:block; font-size:13px; color:var(--ink); margin-bottom:6px; }
.sos-anh-input{ display:none; }
.sos-anh-them{ width:100%; padding:11px 13px; border:1px dashed var(--line); border-radius:9px;
  background:#fff; color:var(--pine-deep); font-family:'Inter',sans-serif; font-size:14px; cursor:pointer; }
.sos-anh-them:hover:not(:disabled){ border-color:var(--pine-deep); }
.sos-anh-them:disabled{ opacity:0.6; cursor:not-allowed; }
.sos-anh-preview-wrap{ position:relative; display:inline-block; }
.sos-anh-preview{ max-height:120px; max-width:100%; border-radius:9px; display:block; border:1px solid var(--line); }
.sos-anh-xoa{ position:absolute; top:6px; right:6px; padding:3px 8px; border:none; border-radius:6px;
  background:rgba(20,39,32,0.7); color:#fff; font-size:11px; cursor:pointer; }
.sos-dialog-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:4px; }
.sos-confirm-btn{ background:var(--clay); color:var(--fog); }
.sos-confirm-btn:hover{ background:var(--clay-soft); }
.sos-dialog-hint{ font-size:11px; color:rgba(42,42,36,0.5); text-align:right; margin-top:8px; }
</style>