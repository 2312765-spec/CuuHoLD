<script setup lang="ts">
import { ref, computed } from 'vue'
import { useOnboarding } from '@/composables/useOnboarding'

// Overlay hướng dẫn 3 bước cho người dùng mới (F-UI-07). Gắn ở App.vue, ngoài <RouterView>.
// Nội dung mô tả bằng lời (không trỏ vào toạ độ phần tử cụ thể) nên không vỡ khi layout đổi.
const { dangMo, hoanTat, dong } = useOnboarding()

interface Buoc { icon: string; tieuDe: string; noiDung: string }
const buoc: Buoc[] = [
  {
    icon: '🆘',
    tieuDe: 'Gửi tín hiệu SOS',
    noiDung:
      'Khi gặp nguy hiểm, mở bản đồ và bấm nút SOS đỏ, chọn loại sự cố (lũ lụt, sạt lở, tai nạn…). Hệ thống tự đính kèm vị trí của bạn và gửi tới trung tâm điều phối.'
  },
  {
    icon: '🚑',
    tieuDe: 'Theo dõi đội cứu hộ',
    noiDung:
      'Sau khi gửi, bạn xem được đội cứu hộ được phân công và vị trí của họ di chuyển trên bản đồ theo thời gian thực, kèm trạng thái cập nhật liên tục.'
  },
  {
    icon: '📶',
    tieuDe: 'Dùng được cả khi mất mạng',
    noiDung:
      'Cài ứng dụng lên máy để mở nhanh hơn; nếu mất mạng, SOS được lưu lại và tự gửi khi có mạng. Cần gấp có thể bấm nút "Gọi khẩn cấp" để gọi thẳng 114/115/113/112.'
  }
]

const chiSo = ref(0)
const laBuocCuoi = computed(() => chiSo.value === buoc.length - 1)

function tiep(): void {
  if (laBuocCuoi.value) hoanTat()
  else chiSo.value++
}
function boQua(): void {
  hoanTat()
}
</script>

<template>
  <transition name="ob-fade">
    <div v-if="dangMo" class="ob-overlay" role="dialog" aria-modal="true" aria-label="Hướng dẫn sử dụng">
      <div class="ob-card">
        <button class="ob-skip" type="button" @click="boQua">Bỏ qua</button>

        <div class="ob-icon" aria-hidden="true">{{ buoc[chiSo].icon }}</div>
        <h2 class="ob-title">{{ buoc[chiSo].tieuDe }}</h2>
        <p class="ob-body">{{ buoc[chiSo].noiDung }}</p>

        <div class="ob-dots" aria-hidden="true">
          <span v-for="i in buoc.length" :key="i" class="ob-dot" :class="{ on: i - 1 === chiSo }" />
        </div>

        <div class="ob-actions">
          <button v-if="chiSo > 0" class="btn btn-ghost" type="button" @click="chiSo--">Quay lại</button>
          <button class="btn btn-primary" type="button" @click="tiep">
            {{ laBuocCuoi ? 'Bắt đầu' : 'Tiếp' }}
          </button>
        </div>

        <p class="ob-count">{{ chiSo + 1 }} / {{ buoc.length }}</p>
      </div>
      <div class="ob-backdrop" @click="dong" />
    </div>
  </transition>
</template>

<style scoped>
.ob-overlay {
  position: fixed;
  inset: 0;
  z-index: 4000; /* trên mọi thanh/nút nổi khác */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}
.ob-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 26, 21, 0.55);
  backdrop-filter: blur(2px);
  z-index: 0;
}
.ob-card {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  background: var(--fog);
  border-radius: 20px;
  padding: 32px 28px 22px;
  box-shadow: 0 20px 50px rgba(20, 39, 32, 0.35);
  text-align: center;
}
.ob-skip {
  position: absolute;
  top: 14px;
  right: 16px;
  border: none;
  background: none;
  color: var(--ink);
  opacity: 0.6;
  font-size: 13px;
  cursor: pointer;
}
.ob-skip:hover { opacity: 1; }
.ob-icon { font-size: 44px; line-height: 1; margin-bottom: 12px; }
.ob-title {
  font-family: 'Fraunces', serif;
  font-size: 24px;
  color: var(--pine-deep);
  margin-bottom: 10px;
}
.ob-body {
  font-size: 15px;
  line-height: 1.6;
  color: rgba(42, 42, 36, 0.75);
  margin-bottom: 20px;
}
.ob-dots {
  display: flex;
  justify-content: center;
  gap: 7px;
  margin-bottom: 22px;
}
.ob-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--line);
  transition: all 0.2s ease;
}
.ob-dot.on {
  width: 22px;
  border-radius: 5px;
  background: var(--clay);
}
.ob-actions {
  display: flex;
  gap: 10px;
  justify-content: center;
}
.ob-actions .btn { min-width: 110px; }
.ob-count {
  margin-top: 14px;
  font-size: 12px;
  color: rgba(42, 42, 36, 0.5);
}
.ob-fade-enter-active,
.ob-fade-leave-active { transition: opacity 0.25s ease; }
.ob-fade-enter-from,
.ob-fade-leave-to { opacity: 0; }
</style>