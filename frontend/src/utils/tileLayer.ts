// Tạo lớp tile nền dùng chung cho CẢ MapView (victim) lẫn RescueMap (commander).
//
// Điểm mấu chốt: bộ tile offline được bundle sẵn nằm ở `/tiles/{z}/{x}/{y}.png` trên chính
// origin của app, trong khi Leaflet mặc định gọi `https://{s}.tile.openstreetmap.org/...`.
// Đó là HAI URL KHÁC NHAU — precache cái này KHÔNG làm cái kia dùng được offline. Nên bắt
// buộc phải đổi hướng ở `getTileUrl`, không có cách nào làm việc này thuần bằng cấu hình
// Workbox (generateSW không cho viết handler tuỳ biến).
//
// Hệ quả phụ có lợi: z8–10 giờ KHÔNG BAO GIỜ chạm tới OSM nữa, kể cả khi đang online —
// giảm hẳn tải lên server tình nguyện của họ ở đúng dải zoom hay dùng nhất, chứ không chỉ
// phục vụ lúc offline.

import L from 'leaflet'
import { TILE_URL, TILE_ATTRIBUTION, duongDanTileOffline } from '@/constants/tileProvider'

export function taoLopTileNen(): L.TileLayer {
  const lop = L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 18,
    // crossOrigin: BẮT BUỘC để service worker đọc được status thật (200/429/...) thay vì
    // 'opaque, status luôn = 0' của request no-cors — nếu không, guard statuses:[200] ở
    // vite.config.ts vô nghĩa. Đã kiểm chứng OSM có hỗ trợ CORS trước khi bật.
    crossOrigin: 'anonymous'
  })

  // Giữ lại hàm gốc rồi gọi lại khi toạ độ nằm ngoài bộ offline — KHÔNG tự ghép chuỗi URL
  // OSM ở đây, để mọi thay đổi về TILE_URL (đổi nhà cung cấp, thêm API key...) chỉ cần sửa
  // đúng một chỗ trong tileProvider.ts như thiết kế ban đầu.
  const layUrlGoc = lop.getTileUrl.bind(lop)
  lop.getTileUrl = (coords: L.Coords): string =>
    duongDanTileOffline(coords.z, coords.x, coords.y) ?? layUrlGoc(coords)

  return lop
}
