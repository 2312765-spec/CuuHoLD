// Nguồn tile bản đồ nền (OpenStreetMap) — TRƯỚC ĐÂY URL/attribution bị gõ tay lặp lại ở
// useLeafletMap.ts (victim) VÀ RescueMap.vue (commander), còn urlPattern để cache lại viết
// dưới dạng regex khác hẳn trong vite.config.ts — 3 nơi biểu diễn cùng một sự thật, không
// nơi nào tham chiếu nơi nào. Hậu quả thật đã xảy ra với file ranh giới geojson: cache
// trỏ nhầm file suốt một thời gian dài mà không ai phát hiện, vì hai chỗ không liên kết
// với nhau bằng code. Gom về đây để đổi nhà cung cấp tile chỉ cần sửa đúng 1 chỗ.
//
// ⚠️ File này được import CẢ TỪ vite.config.ts (chạy trong Node lúc build/dev) LẪN từ code
// Vue chạy trong trình duyệt — do đó TUYỆT ĐỐI không được dùng `import.meta.env` ở đây
// (khác với src/config.ts). Đã kiểm chứng: import.meta.env không tồn tại đúng cách trong
// ngữ cảnh Node của vite.config.ts, dùng nó ở đây sẽ làm vỡ ngay lúc `npm run dev`/`build`.

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors'

// Dùng cho urlPattern của runtimeCaching trong vite.config.ts — PHẢI khớp đúng domain
// trong TILE_URL ở trên. Viết tay riêng vì L.tileLayer dùng cú pháp {s}/{z}/{x}/{y} còn
// Workbox cần regex thật khớp URL cụ thể.
export const TILE_HOST_PATTERN = /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/
