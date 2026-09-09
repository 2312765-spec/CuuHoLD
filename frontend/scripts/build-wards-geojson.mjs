// Sinh public/data/lamdong-wards.geojson — lớp ranh giới 123 xã/phường/đặc khu hiển thị
// trên bản đồ Leaflet (useLeafletMap.ts fetch đúng đường dẫn này).
//
// CHẠY:  npm run build:wards            (tải nguồn từ GitHub)
//        npm run build:wards -- <đường/dẫn/file.json>   (dùng file có sẵn, không cần mạng)
//
// NGUỒN DỮ LIỆU: lam_dong_data.json — https://github.com/2314283-MVQuang/website-cuu-tro
// Trường "name" trong file gốc ghi nguồn là gis.vn. Xem public/data/README.md để biết
// thông tin nguồn/ghi công đầy đủ.
//
// TẠI SAO PHẢI QUA SCRIPT, KHÔNG CHÉP THẲNG FILE GỐC:
// file gốc nặng 19.5 MB vì toạ độ thừa độ chính xác vô nghĩa (VD 107.85158000000007 —
// 14 chữ số thập phân ≈ độ chính xác nanomet, thuần nhiễu dấu phẩy động của máy tính).
// Làm tròn về 4 chữ số (~11 m, thừa đủ để vẽ ranh giới xã ở mức tỉnh — 1 pixel ở zoom
// thường đã là hàng chục mét) đưa file về ~9.2 MB, và ~1.2 MB sau khi nén gzip lúc phục
// vụ: nhẹ hơn bản gốc khoảng 3.5 lần mà mắt thường không phân biệt được.
//
// ⚠️ DỮ LIỆU THIẾU 1 ĐƠN VỊ: Lâm Đồng mới có 124 đơn vị cấp xã theo Nghị quyết
// 1671/NQ-UBTVQH15 (103 xã + 20 phường + 1 đặc khu, hiệu lực 16/6/2025), nhưng nguồn này
// chỉ có 123 — khuyết "Xã Đam Rông 2" (dataset có Đam Rông 1, 3, 4). Bảng `wards` trong
// DB cũng sinh ra từ đúng file này (xem gis/02-seed-wards.sql) nên cùng thiếu, tức bản đồ
// và DB vẫn nhất quán với nhau. Hệ quả cần biết: SOS gửi từ trong địa phận Đam Rông 2 sẽ
// không khớp ward nào qua ST_Contains → ward_code NULL → không vào được room ward tương
// ứng. Khi kiếm được ranh giới Đam Rông 2, bổ sung vào nguồn rồi chạy lại script này.

import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const NGUON_URL =
  'https://raw.githubusercontent.com/2314283-MVQuang/website-cuu-tro/main/public/data/lam_dong_data.json'

// 4 chữ số thập phân ≈ 11 m. Đừng hạ thêm: 3 chữ số (~111 m) bắt đầu thấy méo ranh giới.
const SO_CHU_SO = 4

const thuMucGoc = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DUONG_DAN_RA = resolve(thuMucGoc, 'public/data/lamdong-wards.geojson')

const heSo = 10 ** SO_CHU_SO
const lamTron = (n) => Math.round(n * heSo) / heSo

// Toạ độ GeoJSON lồng nhau nhiều tầng tuỳ kiểu hình học (Polygon/MultiPolygon) — đệ quy
// tới khi chạm cặp [lng, lat] thật sự. GIỮ NGUYÊN THỨ TỰ [kinh độ, vĩ độ] của GeoJSON.
function lamTronToaDo(toaDo) {
  return typeof toaDo[0] === 'number'
    ? [lamTron(toaDo[0]), lamTron(toaDo[1])]
    : toaDo.map(lamTronToaDo)
}

async function docNguon(nguon) {
  if (!nguon) {
    console.log(`Tải nguồn: ${NGUON_URL}`)
    const res = await fetch(NGUON_URL)
    if (!res.ok) throw new Error(`Tải nguồn thất bại (HTTP ${res.status})`)
    return res.json()
  }
  console.log(`Đọc nguồn từ file: ${nguon}`)
  return JSON.parse(await readFile(nguon, 'utf8'))
}

const geojson = await docNguon(process.argv[2])

if (geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) {
  throw new Error('Nguồn không phải GeoJSON FeatureCollection hợp lệ')
}

// Chỉ giữ đúng các trường bản đồ dùng tới, đặt tên khớp thứ useLeafletMap.ts đang đọc
// (ten_xa / ma_xa) và khớp luôn cột bảng `wards` (CLAUDE.md Mục 6).
const features = geojson.features.map((f) => ({
  type: 'Feature',
  properties: {
    ma_xa: f.properties.ma_xa,
    ten_xa: f.properties.ten_xa,
    loai: f.properties.loai,
    sap_nhap: f.properties.sap_nhap,
    dtich_km2: f.properties.dtich_km2,
    dan_so: f.properties.dan_so
  },
  geometry: { type: f.geometry.type, coordinates: lamTronToaDo(f.geometry.coordinates) }
}))

const maTrung = features.length - new Set(features.map((f) => f.properties.ma_xa)).size
if (maTrung > 0) throw new Error(`Nguồn có ${maTrung} mã xã trùng nhau`)

const ketQua = {
  type: 'FeatureCollection',
  name: 'lamdong-wards',
  nguon: 'gis.vn — qua github.com/2314283-MVQuang/website-cuu-tro',
  features
}

await mkdir(dirname(DUONG_DAN_RA), { recursive: true })
const noiDung = JSON.stringify(ketQua)
await writeFile(DUONG_DAN_RA, noiDung)

const theoLoai = features.reduce((acc, f) => {
  acc[f.properties.loai] = (acc[f.properties.loai] || 0) + 1
  return acc
}, {})

console.log(`Đã ghi: ${DUONG_DAN_RA}`)
console.log(`  ${features.length} đơn vị — ${JSON.stringify(theoLoai)}`)
console.log(`  ${(noiDung.length / 1024 / 1024).toFixed(2)} MB (làm tròn ${SO_CHU_SO} chữ số thập phân)`)
if (features.length !== 123) {
  console.log(`  ⚠️ Số đơn vị khác 123 so với lúc viết script — kiểm tra lại nguồn.`)
}
