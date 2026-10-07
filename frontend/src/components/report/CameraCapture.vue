<script setup lang="ts">
// Chụp ảnh hiện trường TRỰC TIẾP bằng camera thiết bị (getUserMedia). Cố ý KHÔNG có ô chọn file
// và KHÔNG dùng <input type="file" capture>: thuộc tính capture chỉ là gợi ý, nhiều trình duyệt
// vẫn cho chọn ảnh có sẵn trong thư viện — mà ảnh cũ/ảnh tải từ mạng chính là thứ làm báo cáo
// sạt lở kém tin cậy. Muốn gửi báo cáo thì BẮT BUỘC cấp quyền camera và chụp tại chỗ.
//
// Ảnh được thu nhỏ + nén JPEG ngay tại đây (utils/image.ts) rồi mới báo ra ngoài cho form.

import { ref, shallowRef, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { kiemTraHoTroCamera, phanLoaiLoiCamera, THONG_BAO_LOI_CAMERA } from '@/utils/camera'
import { chupKhungHinhThanhJpeg } from '@/utils/image'

type TrangThai = 'nghi' | 'dang_mo' | 'truc_tiep' | 'da_chup'

const emit = defineEmits<{ 'update:photo': [blob: Blob | null] }>()

const trangThai = ref<TrangThai>('nghi')
const thongBaoLoi = ref<string | null>(null)
const video = ref<HTMLVideoElement | null>(null)
// shallowRef (KHÔNG phải ref): ref() bọc MediaStream thành Proxy reactive, mà HTMLMediaElement.srcObject
// từ chối Proxy ("The provided value is not of type 'MediaStream'").
const stream = shallowRef<MediaStream | null>(null)
const anhXemTruoc = ref<string | null>(null)
const sanSang = ref(false) // đã có khung hình đầu tiên — chụp trước đó sẽ ra ảnh đen 0×0
const dangChup = ref(false)
let daGoBo = false

function dungCamera(): void {
  stream.value?.getTracks().forEach((t) => t.stop())
  stream.value = null
  if (video.value) video.value.srcObject = null
  sanSang.value = false
}

function xoaXemTruoc(): void {
  if (anhXemTruoc.value) URL.revokeObjectURL(anhXemTruoc.value)
  anhXemTruoc.value = null
}

async function moCamera(): Promise<void> {
  thongBaoLoi.value = null
  const khongDung = kiemTraHoTroCamera(navigator, window.isSecureContext)
  if (khongDung) {
    thongBaoLoi.value = THONG_BAO_LOI_CAMERA[khongDung]
    return
  }
  trangThai.value = 'dang_mo'
  sanSang.value = false
  try {
    const s = await navigator.mediaDevices.getUserMedia({
      // Camera sau (hướng ra hiện trường) nếu có; "ideal" nên máy chỉ có camera trước vẫn mở được.
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false
    })
    // Người dùng rời trang trong lúc chờ cấp quyền → trả camera ngay, không để đèn camera sáng mãi.
    if (daGoBo) {
      s.getTracks().forEach((t) => t.stop())
      return
    }
    stream.value = s
    // Camera bị rút/thu hồi giữa chừng → quay về trạng thái nghỉ kèm lời nhắn, không treo hình đen.
    s.getVideoTracks()[0]?.addEventListener('ended', () => {
      if (stream.value !== s) return
      dungCamera()
      trangThai.value = 'nghi'
      thongBaoLoi.value = 'Camera đã dừng. Hãy bấm "Thử lại" để mở lại.'
    })
    trangThai.value = 'truc_tiep'
    await nextTick()
    if (video.value) {
      video.value.srcObject = s
      // play() có thể bị huỷ nếu srcObject đổi/đóng ngay sau đó — không phải lỗi người dùng cần biết.
      await video.value.play().catch(() => undefined)
    }
  } catch (e) {
    dungCamera()
    trangThai.value = 'nghi'
    thongBaoLoi.value = THONG_BAO_LOI_CAMERA[phanLoaiLoiCamera(e)]
  }
}

function dongCamera(): void {
  dungCamera()
  trangThai.value = 'nghi'
}

async function chup(): Promise<void> {
  const v = video.value
  if (!v || !sanSang.value || v.videoWidth === 0 || dangChup.value) return
  dangChup.value = true
  try {
    const blob = await chupKhungHinhThanhJpeg(v, v.videoWidth, v.videoHeight)
    xoaXemTruoc()
    anhXemTruoc.value = URL.createObjectURL(blob)
    dungCamera() // chụp xong là tắt camera ngay — không để đèn camera sáng khi đã có ảnh
    trangThai.value = 'da_chup'
    emit('update:photo', blob)
  } catch {
    thongBaoLoi.value = 'Không chụp được ảnh. Hãy thử lại.'
  } finally {
    dangChup.value = false
  }
}

function chupLai(): void {
  xoaXemTruoc()
  emit('update:photo', null)
  void moCamera()
}

// Form gọi sau khi gửi xong để quay về trạng thái ban đầu.
function reset(): void {
  dungCamera()
  xoaXemTruoc()
  trangThai.value = 'nghi'
  thongBaoLoi.value = null
}
defineExpose({ reset })

// Đưa trang xuống nền (đổi tab, khoá màn hình) → tắt camera: tiết kiệm pin và không để camera chạy
// ngầm. Quay lại thì bấm mở lại; ảnh đã chụp (nếu có) được giữ nguyên.
function khiDoiTab(): void {
  if (document.hidden && (trangThai.value === 'truc_tiep' || trangThai.value === 'dang_mo')) {
    dongCamera()
  }
}

onMounted(() => document.addEventListener('visibilitychange', khiDoiTab))
onBeforeUnmount(() => {
  daGoBo = true
  document.removeEventListener('visibilitychange', khiDoiTab)
  dungCamera()
  xoaXemTruoc()
})
</script>

<template>
  <div class="camera">
    <div v-if="trangThai === 'dang_mo' || trangThai === 'truc_tiep'" class="camera-live">
      <video ref="video" class="camera-video" autoplay playsinline muted @playing="sanSang = true"></video>
      <p v-if="!sanSang" class="camera-wait">
        Đang mở camera... Nếu trình duyệt hỏi, hãy chọn "Cho phép".
      </p>
      <div class="camera-actions">
        <button
          type="button"
          class="btn btn-primary camera-shutter"
          :disabled="!sanSang || dangChup"
          @click="chup"
        >
          {{ dangChup ? 'Đang chụp...' : 'Chụp ảnh' }}
        </button>
        <button type="button" class="btn btn-ghost" @click="dongCamera">Đóng camera</button>
      </div>
    </div>

    <template v-else-if="trangThai === 'da_chup' && anhXemTruoc">
      <img :src="anhXemTruoc" class="camera-photo" alt="Ảnh hiện trường vừa chụp" />
      <button type="button" class="btn btn-ghost" @click="chupLai">Chụp lại</button>
    </template>

    <button v-else type="button" class="btn btn-primary camera-open" @click="moCamera">
      {{ thongBaoLoi ? 'Thử lại' : 'Mở camera để chụp' }}
    </button>

    <p v-if="thongBaoLoi" class="camera-error" role="alert">{{ thongBaoLoi }}</p>
  </div>
</template>

<style scoped>
.camera {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.camera-video,
.camera-photo {
  display: block;
  width: 100%;
  max-height: 62vh;
  /* contain: khung xem trước hiện ĐÚNG phần sẽ được chụp, không bị cắt như cover. */
  object-fit: contain;
  background: #000;
  border-radius: 10px;
}
.camera-wait {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.6);
}
.camera-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.camera-shutter {
  flex: 1;
  justify-content: center;
  min-height: 48px;
}
.camera-open {
  min-height: 48px;
  justify-content: center;
}
.camera-actions .btn,
.camera .btn-ghost {
  padding: 10px 16px;
  font-size: 14px;
  min-height: 44px;
}
.camera-error {
  font-size: 12px;
  line-height: 1.5;
  color: #b91c1c;
  background: #fef2f2;
  border-radius: 8px;
  padding: 8px 10px;
}
</style>
