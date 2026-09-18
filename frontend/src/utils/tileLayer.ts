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

// z18 → z14: xa hơn thì ảnh phóng 16 lần, mờ tới mức vô nghĩa — thà báo lỗi trung thực.
const TILE_LUI_TOI_DA = 4

// ⚠️ KHÔNG dùng getTileUrl() gốc của Leaflet để lấy URL tile cha bên dưới: nó lấy z từ zoom
// HIỆN TẠI của bản đồ (_getZoomForUrl), bỏ qua coords.z. Ghép bằng L.Util.template trên chính
// TILE_URL thì mọi thay đổi nhà cung cấp vẫn chỉ cần sửa đúng một chỗ ở tileProvider.ts.
function urlTile(z: number, x: number, y: number): string {
  return (
    duongDanTileOffline(z, x, y) ??
    L.Util.template(TILE_URL, { s: 'abc'[Math.abs(x + y) % 3], z, x, y })
  )
}

// Tile thiếu ở zoom sâu → lùi về tile cha rồi phóng to đúng phần tương ứng.
// Lý do: openstreetmap.fr/hot KHÔNG có tile zoom sâu ở vùng thưa dữ liệu — trả 404 bền vững
// (không phải "đang vẽ", thử lại vẫn 404). Đo thật 2026-09-18: rừng (107.9, 11.75) mất từ
// z16, Phú Quý từ z17, Phan Thiết ở z18; chỉ trung tâm Đà Lạt đủ tới z18. Trước đây mỗi tile
// 404 → 'tileerror' → mất nền + toast "Không tải được nền bản đồ" khi zoom hết cỡ, dù thật
// ra chỉ là vùng đó không có ảnh chi tiết hơn.
// Tile phải là <div overflow:hidden> bọc <img> thì mới cắt được một phần ảnh tile cha. Chỉ
// gọi done(lỗi) — tức mới hiện toast — khi lùi hết TILE_LUI_TOI_DA mức vẫn lỗi, lúc đó mới
// đúng là mất mạng/máy chủ hỏng.
export class LopTileNen extends L.TileLayer {
  getTileUrl(coords: L.Coords): string {
    return urlTile(coords.z, coords.x, coords.y)
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const kichThuoc = this.getTileSize()
    const khung = document.createElement('div')
    khung.style.overflow = 'hidden'
    const img = document.createElement('img')
    img.crossOrigin = 'anonymous'
    img.alt = ''
    img.setAttribute('role', 'presentation')
    img.style.position = 'absolute'
    khung.appendChild(img)

    let lui = 0
    const dat = (): void => {
      const s = 2 ** lui
      img.style.width = `${kichThuoc.x * s}px`
      img.style.height = `${kichThuoc.y * s}px`
      img.style.left = `-${(coords.x % s) * kichThuoc.x}px`
      img.style.top = `-${(coords.y % s) * kichThuoc.y}px`
      img.src = urlTile(coords.z - lui, Math.floor(coords.x / s), Math.floor(coords.y / s))
    }
    img.addEventListener('load', () => done(undefined, khung))
    img.addEventListener('error', () => {
      if (lui < TILE_LUI_TOI_DA && coords.z - lui > 0) {
        lui++
        dat()
      } else {
        done(new Error(`Không tải được tile ${coords.z}/${coords.x}/${coords.y}`), khung)
      }
    })
    dat()
    return khung
  }
}

export function taoLopTileNen(): LopTileNen {
  return new LopTileNen(TILE_URL, {
    attribution: TILE_ATTRIBUTION,
    maxZoom: 18
    // crossOrigin đặt trực tiếp trên <img> trong createTile (option của Leaflet chỉ có tác
    // dụng với createTile gốc). BẮT BUỘC để service worker đọc được status thật (200/429/...)
    // thay vì 'opaque, status luôn = 0' của request no-cors — nếu không, guard statuses:[200]
    // ở vite.config.ts vô nghĩa. Nguồn trong TILE_URL PHẢI trả Access-Control-Allow-Origin —
    // openstreetmap.fr/hot trả `*` ở cả a/b/c, kể cả trên trang 404 (kiểm chứng 2026-09-18).
  })
}
