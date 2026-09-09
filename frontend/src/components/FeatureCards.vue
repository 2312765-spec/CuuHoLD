<script setup lang="ts">
import type { FeatureCardData } from '@/types'

// Dữ liệu 3 thẻ được khai báo có kiểu (FeatureCardData) — nếu ai đó thêm 1 thẻ mới mà
// quên field nào, TypeScript báo lỗi ngay lúc code thay vì để thiếu sót lúc chạy.
const cards: FeatureCardData[] = [
  {
    num: '01 — Ranh giới',
    title: 'Ranh giới hành chính',
    desc: 'Bản đồ xã, phường sau sáp nhập 2025, chuẩn hoá theo mã hành chính GSO, dùng để đối chiếu khu vực bị ảnh hưởng.',
    linkLabel: 'Xem lớp ranh giới →',
    layer: 'ranh-gioi'
  },
  {
    num: '02 — Điểm cứu trợ',
    title: 'Điểm tiếp nhận & hỗ trợ',
    desc: 'Vị trí kho vật tư, nơi sơ tán, trạm y tế lưu động — cập nhật sức chứa và tình trạng còn nhận hỗ trợ hay không.',
    linkLabel: 'Xem điểm cứu trợ →',
    layer: 'diem-cuutro'
  },
  {
    num: '03 — Báo cáo',
    title: 'Cảnh báo sự cố',
    desc: 'Người dân và tình nguyện viên gửi vị trí sạt lở, ngập lụt, cây đổ kèm mức độ khẩn cấp để đội cứu hộ ưu tiên xử lý.',
    linkLabel: 'Xem báo cáo gần đây →',
    layer: 'bao-cao'
  }
]
</script>

<template>
  <div class="feat-grid">
    <div v-for="card in cards" :key="card.layer" class="feat-card reveal" v-reveal>
      <span class="feat-num">{{ card.num }}</span>
      <h3>{{ card.title }}</h3>
      <p>{{ card.desc }}</p>
      <!-- KHÔNG dùng target="_blank": phiên đăng nhập lưu trong sessionStorage (riêng từng
           tab, xem stores/auth.store.ts) và rel="noopener" chặn trình duyệt sao chép nó
           sang tab mới — mở tab mới là mất phiên, người dùng vừa đăng nhập ở trang chủ
           xong sang bản đồ lại bị đòi đăng nhập lần nữa. Đi cùng tab thì store Pinia còn
           nguyên trong RAM, không cần khôi phục gì cả. -->
      <RouterLink class="go" :to="{ path: '/map', query: { layer: card.layer } }">
        {{ card.linkLabel }}
      </RouterLink>
    </div>
  </div>
</template>
