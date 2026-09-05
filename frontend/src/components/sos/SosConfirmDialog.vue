<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import type { SosType } from '@/types'

const props = defineProps<{ isOpen: boolean }>()
const emit = defineEmits<{
  cancel: []
  confirm: [payload: { type: SosType; description: string }]
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
      batDauDemNguoc()
    } else {
      dungDemNguoc()
    }
  }
)

function huy() {
  emit('cancel')
}
function guiNgay() {
  dungDemNguoc()
  emit('confirm', { type: loaiDaChon.value, description: moTa.value })
}

onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="sos-dialog-overlay" :class="{ open: isOpen }">
    <div class="sos-dialog-card">
      <h3>Xác nhận gửi tín hiệu cứu trợ</h3>
      <p class="sos-dialog-sub">Vị trí hiện tại của bạn sẽ được gửi tới trung tâm điều phối.</p>

      <label>Loại tình huống
        <select v-model="loaiDaChon">
          <option v-for="l in LOAI_SU_CO" :key="l.value" :value="l.value">{{ l.label }}</option>
        </select>
      </label>

      <label>Mô tả (không bắt buộc)
        <textarea v-model="moTa" rows="2" placeholder="Số người, tình trạng, dấu hiệu nhận biết..."></textarea>
      </label>

      <div class="sos-dialog-actions">
        <button class="btn btn-ghost" @click="huy">Huỷ</button>
        <button class="btn sos-confirm-btn" @click="guiNgay">
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
  background:var(--fog); border-radius:16px; padding:26px; width:100%; max-width:400px;
  box-shadow:0 24px 60px rgba(0,0,0,0.3);
}
.sos-dialog-card h3{ font-family:'Fraunces',serif; font-size:19px; color:var(--pine-deep); margin-bottom:6px; }
.sos-dialog-sub{ font-size:13px; color:rgba(42,42,36,0.65); margin-bottom:18px; }
.sos-dialog-card label{ display:block; font-size:13px; color:var(--ink); margin-bottom:14px; }
.sos-dialog-card select, .sos-dialog-card textarea{
  display:block; width:100%; margin-top:6px; padding:10px 12px;
  border:1px solid var(--line); border-radius:8px; font-family:'Inter',sans-serif; font-size:14px; background:#fff;
}
.sos-dialog-actions{ display:flex; gap:10px; justify-content:flex-end; margin-top:4px; }
.sos-confirm-btn{ background:var(--clay); color:var(--fog); }
.sos-confirm-btn:hover{ background:var(--clay-soft); }
.sos-dialog-hint{ font-size:11px; color:rgba(42,42,36,0.5); text-align:right; margin-top:8px; }
</style>