<script setup lang="ts">
// Ghi chú ranh giới ở cuối bảng chú thích — có chủ đích, không phải chi tiết thừa.
// Xử lý 2 hiểu lầm mà người dùng CHẮC CHẮN sẽ gặp nếu không nói trước:
//
// 1. "Ranh giới tự biến mất khi tôi zoom vào" — đây là hành vi cố ý
//    (useLeafletMap.ts → ZOOM_AN_RANH_GIOI). Không nói ra thì đúng bằng một
//    báo cáo lỗi nữa, cùng dạng với lần báo "bản đồ bị nền trắng che".
// 2. "Điểm SOS này nằm trong xã A theo bản đồ, sao đội xã A không thấy nó?" —
//    đường ranh giới vẽ ra đã được giản lược (sai số ~25m, xem
//    scripts/build-wards-geojson.mjs), còn xã chính thức của mỗi SOS do backend
//    tự suy từ toạ độ GPS bằng ST_Contains trên dữ liệu gốc chưa giản lược.
//    Cùng nguyên tắc với cảnh báo "vị trí ước tính" ở CLAUDE.md Mục 15.6: thà
//    báo trước còn hơn để người dùng tự suy diễn sai giữa lúc cần tin vào bản đồ.
// 3. "Ranh giới vẫn hiện mà nền bản đồ lại trắng khi mất mạng" — ranh giới là lớp
//    VECTOR (tải cùng app, luôn có), còn nền bản đồ (ảnh đường phố/địa hình) là
//    lớp RASTER chỉ cache sẵn offline cho toàn tỉnh ở mức xem tổng quan (zoom xa);
//    zoom sâu vào một khu vực cụ thể cần có mạng ít nhất 1 lần để tải ảnh vùng đó
//    (xem CLAUDE.md Mục 15.7/15.12, src/constants/tileProvider.ts). Không phải lỗi.
</script>

<template>
  <div class="map-legend-panel">
    <div class="legend-row"><span class="sw" style="background:#a8462b"></span>Sự cố khẩn cấp</div>
    <div class="legend-row"><span class="sw" style="background:#1f3d2e"></span>Điểm tiếp nhận</div>
    <div class="legend-row"><span class="sw" style="background:#d99a35"></span>Cảnh báo nguy hiểm</div>
    <p class="legend-note">
      Ranh giới xã/phường chỉ mang tính minh hoạ và tự ẩn khi phóng to.
      Xã chính thức của mỗi yêu cầu được xác định theo toạ độ GPS.
    </p>
    <p class="legend-note">
      Nền bản đồ toàn tỉnh vẫn xem được khi mất mạng. Xem chi tiết một khu vực
      (phóng to sâu) cần có mạng ở lần đầu để tải ảnh vùng đó.
    </p>
  </div>
</template>

<style scoped>
.legend-note {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--line);
  max-width: 210px;
  font-size: 11px;
  line-height: 1.45;
  color: rgba(42, 42, 36, 0.55);
}
</style>
