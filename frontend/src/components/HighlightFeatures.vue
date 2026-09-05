<script setup lang="ts">
// 6 thẻ giữ nguyên SVG riêng từng cái (khác nhau nhiều nên không gộp thành mảng dữ liệu chung),
// chỉ chuyển nguyên khối HTML gốc vào template của component này.
</script>

<template>
  <div class="feat2-grid">
    <div class="feat2-card reveal" v-reveal>
      <div class="feat2-icon">
        <svg viewBox="0 0 24 24" fill="none"><rect x="7" y="2" width="10" height="20" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M11 18H13" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>
      </div>
      <h3>SOS khẩn cấp</h3>
      <p>Gửi tín hiệu cần cứu trợ ngay từ điện thoại, giúp đội cứu hộ nắm tình hình và phản ứng kịp thời.</p>
    </div>
    <div class="feat2-card reveal" v-reveal>
      <div class="feat2-icon">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="20" r="1.4" fill="currentColor"/><circle cx="18" cy="20" r="1.4" fill="currentColor"/><path d="M2 3H4L6.4 15.4A2 2 0 0 0 8.4 17H17A2 2 0 0 0 19 15.4L21 6H5.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h3>Yêu cầu cứu trợ</h3>
      <p>Chọn đúng loại nhu cầu: thực phẩm, nước uống, thuốc men, quần áo hoặc nhu yếu phẩm khác.</p>
    </div>
    <div class="feat2-card reveal" v-reveal>
      <div class="feat2-icon">
        <svg viewBox="0 0 24 24" fill="none"><path d="M9 3L3 5.5V21L9 18.5L15 21L21 18.5V3L15 5.5L9 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M9 3V18.5M15 5.5V21" stroke="currentColor" stroke-width="1.4"/></svg>
      </div>
      <h3>Bản đồ an toàn</h3>
      <p>Xem theo thời gian thực khu vực an toàn, khu vực chịu thiệt hại, và vị trí các điểm hỗ trợ tạm thời.</p>
    </div>
    <div class="feat2-card reveal" v-reveal>
      <div class="feat2-icon">
        <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4"/><path d="M8 12.5L10.5 15L16 9" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <h3>Trạng thái hỗ trợ</h3>
      <p>Theo dõi tiến độ xử lý từng yêu cầu, đảm bảo không bỏ sót trường hợp nào trong quá trình cứu trợ.</p>
    </div>
    <div class="feat2-card reveal" v-reveal>
      <div class="feat2-icon">
        <svg viewBox="0 0 24 24" fill="none"><path d="M3 5H21V16H8L3 20V5Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>
      </div>
      <h3>Liên lạc</h3>
      <p>Kênh liên lạc trực tiếp giữa người dân và đội cứu hộ để giải đáp thắc mắc, xác nhận thông tin.</p>
    </div>
    <div class="feat2-card reveal" v-reveal>
      <div class="feat2-icon">
        <svg viewBox="0 0 24 24" fill="none"><path d="M12 3L22 20H2L12 3Z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 10V14" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="12" cy="17" r="0.9" fill="currentColor"/></svg>
      </div>
      <h3>Cảnh báo thiệt hại</h3>
      <p>Nhận thông báo sớm về nguy cơ sạt lở, ngập lụt mới phát sinh trong khu vực để chủ động phòng tránh.</p>
    </div>
  </div>
</template>
