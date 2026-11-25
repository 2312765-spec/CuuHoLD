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
import {
  TILE_URL,
  TILE_ATTRIBUTION,
  STADIA_TILE_URL,
  STADIA_ATTRIBUTION,
  duongDanTileOffline,
  tileTrongVungProxy
} from '@/constants/tileProvider'
import { coDungProxyTile, coDungStadia, khoaStadia } from '@/constants/tinhNangBackend'
import { CONFIG } from '@/config'
import { useToastStore } from '@/stores/toast'

// z18 → z14: xa hơn thì ảnh phóng 16 lần, mờ tới mức vô nghĩa — thà báo lỗi trung thực.
const TILE_LUI_TOI_DA = 4

// ⚠️ KHÔNG dùng getTileUrl() gốc của Leaflet để lấy URL tile cha bên dưới: nó lấy z từ zoom
// HIỆN TẠI của bản đồ (_getZoomForUrl), bỏ qua coords.z. Ghép bằng L.Util.template trên chính
// TILE_URL thì mọi thay đổi nhà cung cấp vẫn chỉ cần sửa đúng một chỗ ở tileProvider.ts.
function urlUpstream(z: number, x: number, y: number): string {
  return L.Util.template(TILE_URL, { s: 'abc'[Math.abs(x + y) % 3], z, x, y })
}

// ---------------------------------------------------------------------------
// NGUỒN CHÍNH + DỰ PHÒNG. Nguồn chính (ưu tiên theo thứ tự):
//   1. Stadia Maps — VITE_TILE_STADIA (CLAUDE.md Mục 15.31), mọi vùng;
//   2. proxy backend — VITE_DUNG_PROXY_TILE (docs/tile-proxy-plan.md), chỉ ô trong tỉnh.
// Dự phòng luôn là openstreetmap.fr gọi thẳng (urlUpstream). Không bật gì → gọi thẳng như cũ.
//
// Cầu dao: nguồn chính hỏng (Stadia hết hạn mức/đổi điều khoản, backend sập/ngủ) thì bản đồ KHÔNG
// được trắng — tự chuyển sang dự phòng tới hết phiên (tải lại trang mới thử lại nguồn chính).
// Chỉ đếm khi nguồn chính lỗi MÀ dự phòng tải được CÙNG tile đó: <img> không đọc được mã HTTP,
// nên lỗi có thể chỉ là 404 hợp lệ ở vùng thưa dữ liệu (dự phòng cũng 404) — đếm mọi lỗi thì zoom
// sâu ở vùng rừng sẽ ngắt oan.
// ---------------------------------------------------------------------------
const NGUONG_LOI = 4
const CUA_SO_MS = 20_000
let loiGanDay: number[] = []
let nguonChinhDaNgat = false

function ghiNhanNguonChinhHong(): void {
  if (nguonChinhDaNgat) return
  const now = Date.now()
  loiGanDay = loiGanDay.filter((t) => now - t < CUA_SO_MS)
  loiGanDay.push(now)
  if (loiGanDay.length < NGUONG_LOI) return
  nguonChinhDaNgat = true
  try {
    useToastStore().showToast(
      coDungStadia()
        ? 'Nguồn bản đồ chính đang lỗi — đã chuyển sang nguồn bản đồ dự phòng.'
        : 'Máy chủ bản đồ của hệ thống đang chậm — đã chuyển sang tải bản đồ trực tiếp.'
    )
  } catch {
    // Chưa có Pinia (VD trang test) — bỏ qua toast, vẫn chuyển nguồn.
  }
}

// Chỉ dùng trong test (tên giữ từ khi cầu dao chỉ dành cho proxy).
export function datLaiCauDaoProxy(): void {
  loiGanDay = []
  nguonChinhDaNgat = false
}

// URL nguồn chính cho ô này, hoặc null nếu ô này dùng dự phòng.
function urlNguonChinh(z: number, x: number, y: number): string | null {
  if (nguonChinhDaNgat) return null
  if (coDungStadia()) {
    const khoa = khoaStadia()
    const url = L.Util.template(STADIA_TILE_URL, { z, x, y })
    return khoa ? `${url}?api_key=${encodeURIComponent(khoa)}` : url
  }
  if (coDungProxyTile() && tileTrongVungProxy(z, x, y)) {
    return `${CONFIG.apiBaseUrl}/tiles/${z}/${x}/${y}.png`
  }
  return null
}

function urlTile(z: number, x: number, y: number, choPhepNguonChinh = true): string {
  const offline = duongDanTileOffline(z, x, y)
  if (offline) return offline
  return (choPhepNguonChinh ? urlNguonChinh(z, x, y) : null) ?? urlUpstream(z, x, y)
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
    // Nguồn chính đã lỗi cho tile này → mọi lần thử sau (cùng mức + các tile cha) dùng dự phòng.
    let boQuaNguonChinh = false
    // Lần tải hiện tại đang dùng nguồn chính / là lần thử dự phòng ngay sau khi nguồn chính lỗi.
    let dangDungNguonChinh = false
    let dangThuLaiSauLoi = false
    const dat = (): void => {
      const s = 2 ** lui
      img.style.width = `${kichThuoc.x * s}px`
      img.style.height = `${kichThuoc.y * s}px`
      img.style.left = `-${(coords.x % s) * kichThuoc.x}px`
      img.style.top = `-${(coords.y % s) * kichThuoc.y}px`
      const z = coords.z - lui
      const x = Math.floor(coords.x / s)
      const y = Math.floor(coords.y / s)
      dangDungNguonChinh =
        !boQuaNguonChinh && duongDanTileOffline(z, x, y) === null && urlNguonChinh(z, x, y) !== null
      img.src = urlTile(z, x, y, !boQuaNguonChinh)
    }
    img.addEventListener('load', () => {
      if (dangThuLaiSauLoi) ghiNhanNguonChinhHong()
      done(undefined, khung)
    })
    img.addEventListener('error', () => {
      if (dangDungNguonChinh) {
        // Thử lại ĐÚNG mức này bằng nguồn dự phòng trước khi lùi tile cha.
        boQuaNguonChinh = true
        dangThuLaiSauLoi = true
        dat()
        return
      }
      dangThuLaiSauLoi = false
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
    // Stadia bật thì ghi nguồn Stadia (bắt buộc theo điều khoản) + nguồn dự phòng.
    attribution: coDungStadia() ? `${STADIA_ATTRIBUTION} | ${TILE_ATTRIBUTION}` : TILE_ATTRIBUTION,
    maxZoom: 18
    // crossOrigin đặt trực tiếp trên <img> trong createTile (option của Leaflet chỉ có tác
    // dụng với createTile gốc). BẮT BUỘC để service worker đọc được status thật (200/429/...)
    // thay vì 'opaque, status luôn = 0' của request no-cors — nếu không, guard statuses:[200]
    // ở vite.config.ts vô nghĩa. Nguồn trong TILE_URL PHẢI trả Access-Control-Allow-Origin —
    // openstreetmap.fr/hot trả `*` ở cả a/b/c, kể cả trên trang 404 (kiểm chứng 2026-09-18).
  })
}
