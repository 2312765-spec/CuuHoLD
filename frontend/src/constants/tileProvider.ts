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
//
// ⚠️ SAU KHI SỬA FILE NÀY, `npx vue-tsc --noEmit` có thể báo lỗi GIẢ kiểu
// "Module '@/constants/tileProvider' has no exported member '...'". Nguyên nhân: file này
// nằm trong CẢ tsconfig.json (app) LẪN tsconfig.node.json (composite, cho vite.config.ts),
// nên app đọc qua bản .d.ts sinh ra ở node_modules/.tmp — bản đó CHƯA được cập nhật cho
// tới khi chạy `vue-tsc -b`. Chạy `npm run build` một lần là hết. CI không dính lỗi này vì
// nó vốn chạy `npm run build` (tức `vue-tsc -b`, có dựng lại project reference).

export const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION = '&copy; OpenStreetMap contributors'

// Dùng cho urlPattern của runtimeCaching trong vite.config.ts — PHẢI khớp đúng domain
// trong TILE_URL ở trên. Viết tay riêng vì L.tileLayer dùng cú pháp {s}/{z}/{x}/{y} còn
// Workbox cần regex thật khớp URL cụ thể.
export const TILE_HOST_PATTERN = /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/

// ---------------------------------------------------------------------------
// BẢN ĐỒ OFFLINE (SRS F-PWA-03)
// ---------------------------------------------------------------------------
// SRS yêu cầu pre-cache tile Lâm Đồng z8–14. Làm ĐÚNG NGUYÊN VĂN là bất khả thi:
// đo thật ra 15.461 tile ≈ 106–226 MB (riêng z14 chiếm 74%) — bắt chính người dùng
// mạng yếu tải hàng trăm MB thì phản tác dụng với mục đích của tính năng.
//
// Phạm vi THẬT đang làm: z8–10 (96 tile, ~0,6–1,3 MB), TẢI SẴN MỘT LẦN lúc build
// (scripts/build-offline-tiles.mjs) rồi commit vào public/tiles/ và precache qua
// Workbox. z11+ vẫn cache thụ động theo thao tác thật của người dùng (NetworkFirst).
//
// ⚠️ VÌ SAO PHẢI TẢI SẴN CHỨ KHÔNG ĐỂ APP TỰ TẢI LÚC CHẠY: OSM đã từng CHẶN THẬT app
// này (trả HTTP 200 kèm ảnh PNG ghi "Access blocked" — không phải mã lỗi, nên mọi guard
// theo status đều không bắt được). Nếu mỗi lần cài app lại tự bắn ~96 request lên OSM
// thì với N người dùng là N×96 — đúng kiểu tải hàng loạt mà chính sách của họ cấm, và
// nếu bị chặn thì hỏng CẢ bản đồ chính chứ không riêng tính năng offline. Tải sẵn 1 lần
// lúc dev đưa số request về đúng 1 lần duy nhất, không nhân theo số người dùng.
export const OFFLINE_TILE_MAX_ZOOM = 10

// Biên đã làm tròn RỘNG RA so với bbox thật của lamdong-wards.geojson
// (107.2062, 9.9701 → 109.0850, 12.8125) để chắc chắn phủ hết. Script build tự kiểm lại
// điều này và ném lỗi nếu geojson vượt ra ngoài — không dựa vào trí nhớ.
export const LAMDONG_BBOX = { minLng: 107.1, minLat: 9.8, maxLng: 109.2, maxLat: 12.9 }

export function tileX(lng: number, z: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** z)
}

export function tileY(lat: number, z: number): number {
  const r = (lat * Math.PI) / 180
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
}

// Trả về đường dẫn file tile đã bundle sẵn, hoặc null nếu toạ độ này KHÔNG nằm trong bộ
// đã tải (zoom sâu hơn, hoặc người dùng pan ra ngoài Lâm Đồng) — lúc đó gọi OSM như cũ.
// Thiếu phép kiểm bbox này thì pan ra khỏi tỉnh ở z8–10 sẽ ra 404 → tile trắng, tệ hơn
// hiện trạng: đây là lý do hàm trả null chứ không phải luôn trả đường dẫn local.
// Số ô tile nới thêm quanh bbox, theo từng mức zoom. Lý do: ở zoom xa nhất, màn hình rộng
// hơn hẳn bề ngang tỉnh — đo thật trên 1366px thì gần nửa màn hình là ô NGOÀI tỉnh, offline
// sẽ trơ nền be. Nới 2 ô ở z8 chỉ tốn thêm 36 tile (6→42) vì mỗi ô z8 rất lớn; càng zoom
// sâu thì nới càng đắt theo cấp số nhân nên z10 để 0 — lúc đó người xem đã ở trong tỉnh rồi.
// Tổng: 154 tile (~2,6 MB).
export const OFFLINE_TILE_PADDING: Record<number, number> = { 8: 2, 9: 1, 10: 0 }

export function duongDanTileOffline(z: number, x: number, y: number): string | null {
  if (z > OFFLINE_TILE_MAX_ZOOM) return null
  const p = OFFLINE_TILE_PADDING[z] ?? 0
  const x0 = tileX(LAMDONG_BBOX.minLng, z) - p
  const x1 = tileX(LAMDONG_BBOX.maxLng, z) + p
  const y0 = tileY(LAMDONG_BBOX.maxLat, z) - p
  const y1 = tileY(LAMDONG_BBOX.minLat, z) + p
  if (x < x0 || x > x1 || y < y0 || y > y1) return null
  return `/tiles/${z}/${x}/${y}.png`
}
