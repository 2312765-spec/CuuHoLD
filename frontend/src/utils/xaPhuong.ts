// Danh sách 124 xã/phường/đặc khu Lâm Đồng (tên + khung bao) dựng từ CÙNG file ranh giới mà
// bản đồ đã tải (public/data/lamdong-wards.geojson, khớp bảng `wards` — xem data/README.md).
// Dùng cho: hiện TÊN xã thay vì mã số thô ("Xã/phường 24778"), và bộ lọc xã/phường bay bản đồ
// tới đúng xã. Không gọi API nào: file tĩnh, trình duyệt/PWA đã cache sẵn khi mở bản đồ.

export interface XaPhuong {
  ma: string
  ten: string // "Lâm Viên - Đà Lạt"
  loai: string // 'Phường' | 'Xã' | 'Đặc khu'
  // [[nam, tây], [bắc, đông]] — đúng dạng L.LatLngBoundsExpression, không cần import Leaflet.
  khung: [[number, number], [number, number]]
}

const DUONG_DAN = '/data/lamdong-wards.geojson'

interface FeatureThuo {
  properties?: Record<string, unknown> | null
  geometry?: { type?: string; coordinates?: unknown } | null
}

// GeoJSON lưu [kinh độ, vĩ độ]; duyệt đệ quy để dùng chung cho Polygon lẫn MultiPolygon.
function moRongKhung(toaDo: unknown, k: { s: number; w: number; n: number; e: number }): void {
  if (!Array.isArray(toaDo)) return
  if (typeof toaDo[0] === 'number' && typeof toaDo[1] === 'number') {
    const [lng, lat] = toaDo as number[]
    if (lat < k.s) k.s = lat
    if (lat > k.n) k.n = lat
    if (lng < k.w) k.w = lng
    if (lng > k.e) k.e = lng
    return
  }
  for (const con of toaDo) moRongKhung(con, k)
}

export function dungDanhSachXa(geojson: unknown): XaPhuong[] {
  const features = (geojson as { features?: FeatureThuo[] } | null)?.features
  if (!Array.isArray(features)) return []
  const ds: XaPhuong[] = []
  for (const f of features) {
    const p = f.properties ?? {}
    const ma = p.ma_xa != null ? String(p.ma_xa) : ''
    const ten = typeof p.ten_xa === 'string' ? p.ten_xa : ''
    if (!ma || !ten) continue
    const k = { s: Infinity, w: Infinity, n: -Infinity, e: -Infinity }
    moRongKhung(f.geometry?.coordinates, k)
    if (!Number.isFinite(k.s)) continue
    ds.push({
      ma,
      ten,
      loai: typeof p.loai === 'string' ? p.loai : 'Xã',
      khung: [
        [k.s, k.w],
        [k.n, k.e]
      ]
    })
  }
  return ds.sort((a, b) => a.ten.localeCompare(b.ten, 'vi'))
}

export function tenDayDu(x: Pick<XaPhuong, 'ten' | 'loai'>): string {
  return `${x.loai} ${x.ten}`
}

// Bỏ dấu để tìm "lam vien" vẫn ra "Lâm Viên" (gõ trên điện thoại không dấu rất phổ biến).
export function boDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

// Tải 1 lần cho cả app; lỗi thì cho phép thử lại lần sau thay vì nhớ mãi lời hứa hỏng.
let dangTai: Promise<XaPhuong[]> | null = null

export function taiDanhSachXa(): Promise<XaPhuong[]> {
  if (!dangTai) {
    dangTai = fetch(DUONG_DAN)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: unknown) => dungDanhSachXa(json))
      .catch(() => [] as XaPhuong[])
      .then((ds) => {
        if (ds.length === 0) dangTai = null
        return ds
      })
  }
  return dangTai
}
