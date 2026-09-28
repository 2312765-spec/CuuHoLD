<script setup lang="ts">
// F-SOS-06 — xem ảnh hiện trường cho rescuer/commander (CLAUDE.md Mục 15.14).
// Chỉ tải khi người dùng bấm: đội cứu hộ ngoài thực địa thường dùng 3G/4G, không nên tự kéo
// vài trăm KB cho mọi thẻ nhiệm vụ. Ảnh tải qua http (có Bearer token) rồi hiện bằng object
// URL — không dùng thẳng <img src="/api/..."> vì thẻ img không gửi được token, mà ảnh nạn
// nhân bắt buộc kiểm quyền.
import { ref, watch, onBeforeUnmount } from 'vue'
import { taiAnhSos } from '@/services/sosService'

const props = defineProps<{ sosId: string }>()

const anhUrl = ref('')
const dangTai = ref(false)
const loi = ref(false)

function giaiPhong() {
  if (anhUrl.value) URL.revokeObjectURL(anhUrl.value)
  anhUrl.value = ''
  loi.value = false
}

async function xemAnh() {
  dangTai.value = true
  loi.value = false
  try {
    const blob = await taiAnhSos(props.sosId)
    giaiPhong()
    anhUrl.value = URL.createObjectURL(blob)
  } catch {
    // http.ts đã hiện toast lý do (404/403/mất mạng) — ở đây chỉ cho bấm thử lại.
    loi.value = true
  } finally {
    dangTai.value = false
  }
}

watch(() => props.sosId, giaiPhong)
onBeforeUnmount(giaiPhong)
</script>

<template>
  <div class="anh-hien-truong">
    <a v-if="anhUrl" :href="anhUrl" target="_blank" rel="noopener" class="anh-hien-truong__link">
      <img :src="anhUrl" alt="Ảnh hiện trường do người báo SOS gửi" class="anh-hien-truong__img" />
    </a>
    <button v-else type="button" class="anh-hien-truong__nut" :disabled="dangTai" @click="xemAnh">
      {{ dangTai ? 'Đang tải ảnh…' : loi ? 'Tải ảnh lỗi — thử lại' : '📷 Xem ảnh hiện trường' }}
    </button>
  </div>
</template>

<style scoped>
.anh-hien-truong {
  margin-top: 8px;
}
.anh-hien-truong__nut {
  min-height: 40px;
  padding: 0 14px;
  border: 1px dashed var(--line, #d8d0bd);
  border-radius: 9px;
  background: #ffffff;
  color: var(--pine-deep, #142720);
  font: 500 13px/1 'Inter', sans-serif;
  cursor: pointer;
}
.anh-hien-truong__nut:disabled {
  opacity: 0.6;
  cursor: wait;
}
.anh-hien-truong__nut:focus-visible,
.anh-hien-truong__link:focus-visible {
  outline: 3px solid var(--pine-deep, #142720);
  outline-offset: 2px;
}
.anh-hien-truong__img {
  display: block;
  max-width: 100%;
  max-height: 220px;
  border-radius: 9px;
  border: 1px solid var(--line, #d8d0bd);
  object-fit: contain;
}
</style>
