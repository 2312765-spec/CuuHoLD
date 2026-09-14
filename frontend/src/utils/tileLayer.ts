// Tạo lớp tile nền dùng chung cho CẢ MapView (victim) lẫn RescueMap (commander).
//
// Điểm mấu chốt: bộ tile offline được bundle sẵn nằm ở `/tiles/{z}/{x}/{y}.png` trên chính
// origin của app, trong khi Leaflet gọi TILE_URL của nhà cung cấp (tileProvider.ts).
// Đó là HAI URL KHÁC NHAU — precache cái này KHÔNG làm cái kia dùng được offline. Nên bắt
// buộc phải đổi hướng ở `getTileUrl`, không có cách nào làm việc này thuần bằng cấu hình
// Workbox (generateSW không cho viết handler tuỳ biến).
//
// Hệ quả phụ có lợi: z8–10 KHÔNG BAO GIỜ chạm tới máy chủ tile bên ngoài, kể cả khi đang
// online — giảm tải lên server tình nguyện ở đúng dải zoom hay dùng nhất, và dải này vẫn
// có nền dù nhà mạng chặn nhà cung cấp tile (như Viettel từng chặn openstreetmap.org).

import L from 'leaflet'
import { TILE_URL, TILE_ATTRIBUTION, duongDanTileOffline } from '@/constants/tileProvider'

export function taoLopTileNen(): L.TileLayer {
  const lop = L.tileLayer(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 18,
    // crossOrigin: BẮT BUỘC để service worker đọc được status thật (200/429/...) thay vì
    // 'opaque, status luôn = 0' của request no-cors — nếu không, guard statuses:[200] ở
    // vite.config.ts vô nghĩa. Nguồn trong TILE_URL PHẢI trả Access-Control-Allow-Origin —
    // openstreetmap.fr/hot đã kiểm chứng trả `*` ở cả a/b/c (2026-09-13). Đổi nguồn thì kiểm
    // lại header này Ở CẢ ZOOM SÂU: tile lỗi 404 thường không kèm CORS, trình duyệt sẽ báo
    // nhầm thành "lỗi CORS" (đúng chuyện đã xảy ra với openstreetmap.de ở z18).
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
