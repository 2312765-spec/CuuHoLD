// Chỉ hiển thị bản đồ trong tỉnh Lâm Đồng (CLAUDE.md 15.34):
//  1. Che vùng ngoài tỉnh bằng một lớp màu nền — nước láng giềng, tỉnh khác, biển đảo và địa
//     danh ngoài tỉnh không còn hiện ra (tránh nội dung nhạy cảm, và đây là app CỦA TỈNH).
//  2. Không cho kéo/thu nhỏ bản đồ ra xa khỏi tỉnh (maxBounds + minZoom vừa khít tỉnh).
// Đường viền tỉnh: public/data/lamdong-outline.geojson, sinh bằng `npm run build:outline` từ
// chính file ranh giới xã/phường (gộp 124 xã thành đất liền + đảo Phú Quý).
import L from 'leaflet'

const DUONG_DAN = '/data/lamdong-outline.geojson'
const TEN_PANE = 'vungNgoaiTinh'
// Cùng màu nền Leaflet (map-style.css .leaflet-container) để vùng che trông như "không có gì".
const MAU_CHE = '#eae3d0'
const MAU_VIEN = '#8a3a20'
// Lề quanh tỉnh được phép kéo tới — đủ thấy viền tỉnh trọn vẹn, không đủ thấy nước khác rõ.
const LE_KEO = 0.12
// Khung chữ nhật bao ngoài cho lớp che: chỉ cần rộng hơn vùng được phép nhìn (đã bị giới hạn).
const KHUNG_CHE: L.LatLngExpression[] = [
  [3, 98],
  [3, 120],
  [20, 120],
  [20, 98]
]

type Vong = [number, number][] // [vĩ, kinh]

// GeoJSON [kinh, vĩ] → Leaflet [vĩ, kinh]; chỉ lấy vòng ngoài của mỗi đa giác.
export function trichVongNgoai(geojson: unknown): Vong[] {
  const ketQua: Vong[] = []
  const them = (g: { type?: string; coordinates?: unknown } | null | undefined): void => {
    if (!g) return
    if (g.type === 'Polygon') {
      const c = g.coordinates as number[][][]
      if (c?.[0]) ketQua.push(c[0].map(([lng, lat]) => [lat, lng]))
    } else if (g.type === 'MultiPolygon') {
      for (const p of g.coordinates as number[][][][]) {
        if (p?.[0]) ketQua.push(p[0].map(([lng, lat]) => [lat, lng]))
      }
    }
  }
  const d = geojson as {
    type?: string
    features?: { geometry?: { type?: string; coordinates?: unknown } }[]
    geometries?: { type?: string; coordinates?: unknown }[]
    geometry?: { type?: string; coordinates?: unknown }
  } | null
  if (!d) return ketQua
  if (Array.isArray(d.features)) d.features.forEach((f) => them(f.geometry))
  else if (Array.isArray(d.geometries)) d.geometries.forEach(them)
  else if (d.geometry) them(d.geometry)
  else them(d as { type?: string; coordinates?: unknown })
  return ketQua
}

let dangTai: Promise<Vong[]> | null = null

export function taiVienTinh(): Promise<Vong[]> {
  if (!dangTai) {
    dangTai = fetch(DUONG_DAN)
      .then((r) => (r.ok ? r.json() : null))
      .then(trichVongNgoai)
      .catch(() => [] as Vong[])
      .then((v) => {
        if (v.length === 0) dangTai = null // lỗi mạng → lần sau thử lại
        return v
      })
  }
  return dangTai
}

// Áp giới hạn tỉnh lên một bản đồ. Trả về hàm gỡ (gọi khi huỷ bản đồ).
export function apDungGioiHanTinh(map: L.Map): () => void {
  let daGo = false
  const lop: L.Layer[] = []
  const capNhatZoomToiThieu = (): void => {
    const khung = map.options.maxBounds
    if (!khung) return
    const z = map.getBoundsZoom(L.latLngBounds(khung as L.LatLngBoundsLiteral), false)
    if (Number.isFinite(z)) map.setMinZoom(Math.max(5, Math.floor(z)))
  }

  void taiVienTinh().then((vong) => {
    // Bản đồ đã bị huỷ (rời trang) trước khi tải xong → map.remove() đã xoá các pane.
    if (daGo || vong.length === 0 || !map.getPane('mapPane')) return
    const khung = L.latLngBounds(vong.flat())
    map.setMaxBounds(khung.pad(LE_KEO))
    map.options.maxBoundsViscosity = 1
    capNhatZoomToiThieu()
    map.on('resize', capNhatZoomToiThieu)

    if (!map.getPane(TEN_PANE)) {
      const pane = map.createPane(TEN_PANE)
      pane.style.zIndex = '350' // trên nền tile (200), dưới marker/vùng cảnh báo (400+)
      pane.style.pointerEvents = 'none'
    }
    // Lớp che vẽ bằng SVG riêng (map dùng preferCanvas cho marker). Trình duyệt không vẽ được
    // SVG (VD jsdom lúc test) → vẫn giữ giới hạn kéo/thu nhỏ ở trên, chỉ bỏ lớp che.
    if (!L.Browser.svg) return
    const renderer = L.svg({ pane: TEN_PANE })
    lop.push(
      L.polygon([KHUNG_CHE, ...vong], {
        renderer,
        stroke: false,
        fillColor: MAU_CHE,
        // Kín hoàn toàn: ở 0.94 vẫn đọc lờ mờ được tên nước/tỉnh khác bên dưới.
        fillOpacity: 1,
        interactive: false
      }).addTo(map),
      L.polygon(vong, {
        renderer,
        fill: false,
        color: MAU_VIEN,
        weight: 2,
        opacity: 0.8,
        interactive: false
      }).addTo(map)
    )
  })

  return () => {
    daGo = true
    map.off('resize', capNhatZoomToiThieu)
    lop.forEach((l) => l.remove())
  }
}
