<script setup lang="ts">
// Thẻ theo dõi SOS vừa gửi — tách riêng khỏi MapView.vue (vốn đang gánh quá nhiều thứ:
// auth modal, gửi/huỷ SOS, socket, offline queue, tải ranh giới...) để dễ đọc/test hơn.
// Component này THUẦN trình diễn — không tự gọi API, chỉ nhận state qua props và phát sự
// kiện ra ngoài cho MapView xử lý (mở dialog huỷ / đóng thẻ theo dõi).

import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { ActiveSos } from '@/composables/useSos'
import { SOS_TYPE_LABEL, SOS_STATUS_LABEL } from '@/constants/sosLabels'

const props = defineProps<{
  activeSos: ActiveSos
  dangHoatDong: boolean
  dangHuy: boolean
}>()

const emit = defineEmits<{ huy: []; dong: [] }>()

// Đồng hồ tick mỗi giây để đếm ngược hạn huỷ miễn phạt. Component này chỉ tồn tại trong
// DOM khi có activeSos (MapView bọc bằng v-if) nên onMounted/onUnmounted đã đủ để bắt đầu/
// dừng đúng lúc — không cần watch thêm.
const nowTick = ref(Date.now())
let tickId: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tickId = setInterval(() => (nowTick.value = Date.now()), 1000)
})
onUnmounted(() => {
  if (tickId !== null) clearInterval(tickId)
})

const conHanHuyMienPhat = computed(
  () => nowTick.value < new Date(props.activeSos.cancelDeadline).getTime()
)
const demNguocHuy = computed(() => {
  if (!conHanHuyMienPhat.value) return null
  const msConLai = new Date(props.activeSos.cancelDeadline).getTime() - nowTick.value
  const tongGiay = Math.max(0, Math.floor(msConLai / 1000))
  const phut = Math.floor(tongGiay / 60)
  const giay = tongGiay % 60
  return `${phut}:${giay.toString().padStart(2, '0')}`
})
</script>

<template>
  <div class="sos-tracker">
    <div class="sos-tracker-top">
      <span class="sos-tracker-badge">{{ SOS_TYPE_LABEL[activeSos.type] }}</span>
      <span class="sos-tracker-status">{{ SOS_STATUS_LABEL[activeSos.status] }}</span>
    </div>

    <p v-if="activeSos.locationEstimated" class="sos-tracker-note sos-tracker-note--warn">
      ⚠️ Vị trí gửi là ước tính (không lấy được GPS chính xác) — hãy mô tả rõ vị trí thật nếu
      liên hệ được với trung tâm điều phối.
    </p>
    <p v-if="activeSos.localId" class="sos-tracker-note sos-tracker-note--warn">
      Không có mạng — đã lưu trên máy, sẽ tự gửi ngay khi có mạng trở lại
    </p>
    <p v-else-if="dangHoatDong && demNguocHuy" class="sos-tracker-note">
      Còn <b>{{ demNguocHuy }}</b> để huỷ miễn phạt
    </p>
    <p v-else-if="dangHoatDong" class="sos-tracker-note sos-tracker-note--warn">
      Đã quá 3 phút — huỷ bây giờ sẽ bị tính là huỷ trễ
    </p>
    <p v-else class="sos-tracker-note">Yêu cầu đã kết thúc.</p>

    <!-- Thông tin đội cứu hộ khi đã được phân công (F-SOS-03 phía victim nhận) -->
    <div v-if="activeSos.assignedTeamId" class="sos-tracker-team">
      <span class="sos-tracker-team-icon">🚑</span>
      <span>{{ activeSos.teamDangDiChuyen ? 'Đội cứu hộ đang di chuyển tới bạn' : 'Đã có đội cứu hộ được phân công' }}</span>
    </div>

    <div class="sos-tracker-actions">
      <button v-if="dangHoatDong" class="btn btn-ghost" :disabled="dangHuy" @click="emit('huy')">
        {{ dangHuy ? 'Đang huỷ...' : 'Huỷ yêu cầu' }}
      </button>
      <button v-else class="btn btn-ghost" @click="emit('dong')">Đóng</button>
    </div>
  </div>
</template>

<style scoped>
.sos-tracker {
  position: fixed;
  right: 16px;
  top: 150px;
  z-index: 960;
  width: min(280px, calc(100vw - 32px));
  background: rgba(255, 255, 255, 0.96);
  border-radius: 12px;
  padding: 14px 16px;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.15);
}
.sos-tracker-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}
.sos-tracker-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--pine-deep);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.sos-tracker-status {
  font-size: 11px;
  color: rgba(42, 42, 36, 0.6);
}
.sos-tracker-note {
  font-size: 12px;
  color: rgba(42, 42, 36, 0.7);
  margin-bottom: 10px;
}
.sos-tracker-note--warn {
  color: var(--clay);
}
.sos-tracker-team {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(31, 61, 46, 0.08);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
  font-size: 12px;
  font-weight: 500;
  color: var(--pine-deep);
}
.sos-tracker-team-icon {
  font-size: 15px;
}
.sos-tracker-actions {
  display: flex;
  justify-content: flex-end;
}
.sos-tracker-actions .btn {
  padding: 6px 14px;
  font-size: 12px;
}

@media (min-width: 1024px) {
  .sos-tracker {
    top: 112px;
  }
}
</style>