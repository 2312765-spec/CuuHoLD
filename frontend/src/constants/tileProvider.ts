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

// ⚠️ KHÔNG dùng *.openstreetmap.org: Viettel (nhà mạng lớn nhất VN) chặn CẢ tên miền này ở
// DNS — trả 127.0.0.1 cho tile lẫn wiki (kiểm chứng 2026-09-13, hỏi thẳng DNS Viettel
// 203.113.131.1). Người dùng Viettel để DNS mặc định mất nền bản đồ ở mọi zoom tải qua mạng.
//
// Nguồn đang dùng: style HOT (Humanitarian OSM Team) do OSM France host — cùng dữ liệu OSM,
// không cần key, có CORS `*`, DNS Viettel không chặn. ⚠️ Tile zoom sâu CHỈ có ở vùng
// nhiều dữ liệu (trung tâm Đà Lạt tới z18) — vùng thưa trả 404 từ z16/z17 (đo 2026-09-18);
// utils/tileLayer.ts tự lùi về tile cha nên không mất nền. Vẫn là máy chủ TÌNH
// NGUYỆN, không SLA — lời giải cho đồ án, chưa phải cho triển khai thật (CLAUDE.md Mục 15.7
// việc #4). Chỉ subdomain a/b/c phục vụ tile — host trần tile.openstreetmap.fr/hot/ trả 404.
//
// Đã loại (đều kiểm chứng 2026-09-13, xem ẢNH chứ không chỉ status):
// - tile.openstreetmap.de: trả 404 (text/html, KHÔNG kèm CORS) ở z18 tại nhiều vùng Lâm
//   Đồng — trình duyệt báo "lỗi CORS" dù lỗi thật là không có tile → mất nền khi zoom hết cỡ.
// - Carto: HTTP 200 + CORS đầy đủ nhưng ảnh in chữ "API KEY REQUIRED".
export const TILE_URL = 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png'
export const TILE_ATTRIBUTION =
  '&copy; OpenStreetMap contributors, style <a href="https://www.hotosm.org/">HOT</a>, hosted by <a href="https://openstreetmap.fr/">OSM France</a>'

// Dùng cho urlPattern của runtimeCaching trong vite.config.ts — PHẢI khớp đúng domain
// trong TILE_URL ở trên (tileProvider.spec.ts kiểm tra điều này). Viết tay riêng vì
// L.tileLayer dùng cú pháp {s}/{z}/{x}/{y} còn Workbox cần regex thật khớp URL cụ thể.
export const TILE_HOST_PATTERN = /^https:\/\/[abc]\.tile\.openstreetmap\.fr\/hot\/.*/

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
export const OFFLINE_TILE_MIN_ZOOM = 8
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
  // Chặn CẢ HAI đầu: trước đây chỉ chặn trên, nên điện thoại (~390px, mở ở z7 để vừa cả
  // tỉnh) bị trỏ vào /tiles/7/... không tồn tại → Vite trả index.html → ô trống màu nền.
  if (z < OFFLINE_TILE_MIN_ZOOM || z > OFFLINE_TILE_MAX_ZOOM) return null
  const p = OFFLINE_TILE_PADDING[z] ?? 0
  const x0 = tileX(LAMDONG_BBOX.minLng, z) - p
  const x1 = tileX(LAMDONG_BBOX.maxLng, z) + p
  const y0 = tileY(LAMDONG_BBOX.maxLat, z) - p
  const y1 = tileY(LAMDONG_BBOX.minLat, z) + p
  if (x < x0 || x > x1 || y < y0 || y > y1) return null
  return `/tiles/${z}/${x}/${y}.png`
}

// ---------------------------------------------------------------------------
// PROXY TILE QUA BACKEND (docs/tile-proxy-plan.md, bật bằng VITE_DUNG_PROXY_TILE)
// ---------------------------------------------------------------------------
// Backend (backend/src/tiles/tile-bounds.ts) CHỈ phục vụ ô phủ Lâm Đồng + nới 2 ô — ⚠️ PHẢI
// KHỚP với hằng số bên đó. Ô ngoài vùng này frontend gọi thẳng upstream, không xin proxy (sẽ 400).
export const TILE_PROXY_PADDING = 2
export const TILE_PROXY_MAX_ZOOM = 18

export function tileTrongVungProxy(z: number, x: number, y: number): boolean {
  if (z < 0 || z > TILE_PROXY_MAX_ZOOM) return false
  const p = TILE_PROXY_PADDING
  return (
    x >= tileX(LAMDONG_BBOX.minLng, z) - p &&
    x <= tileX(LAMDONG_BBOX.maxLng, z) + p &&
    y >= tileY(LAMDONG_BBOX.maxLat, z) - p &&
    y <= tileY(LAMDONG_BBOX.minLat, z) + p
  )
}

// urlPattern cho runtimeCaching (vite.config.ts) — khớp `<VITE_API_BASE_URL>/tiles/z/x/y.png`
// ở bất kỳ tên miền backend nào (onrender.com hay cùng origin lúc dev).
export const PROXY_TILE_PATTERN = /\/api\/tiles\/\d+\/\d+\/\d+\.png$/

// ---------------------------------------------------------------------------
// NGUỒN CHÍNH STADIA MAPS (bật bằng VITE_TILE_STADIA — CLAUDE.md Mục 15.31)
// ---------------------------------------------------------------------------
// Gói Free: 200.000 tile/tháng, phi thương mại. Style `outdoors` (Standard Raster Basemap — có
// trong gói Free, KHÔNG dùng style trả phí: hết dùng thử 2026-12-09 sẽ hỏng): có địa hình/độ
// cao, không vẽ ranh giới hành chính nét đứt chồng lên lớp ranh giới xã của app.
// Kiểm chứng 2026-11-25 (MỞ ẢNH xem, không chỉ status): tile thật, nhãn tiếng Việt, tới z18 ở cả
// rừng (107.9, 11.75) lẫn Phú Quý — nơi openstreetmap.fr trả 404 từ z16. CORS `*`.
// openstreetmap.fr (TILE_URL ở trên) là nguồn DỰ PHÒNG khi Stadia lỗi/hết hạn mức (tileLayer.ts).
export const STADIA_TILE_URL = 'https://tiles.stadiamaps.com/tiles/outdoors/{z}/{x}/{y}.png'
export const STADIA_ATTRIBUTION =
  '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
// urlPattern cho runtimeCaching (vite.config.ts) — khớp cả khi có ?api_key.
export const STADIA_HOST_PATTERN = /^https:\/\/tiles\.stadiamaps\.com\/tiles\/outdoors\/.*/
