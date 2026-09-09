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
// Script làm 2 việc, theo đúng thứ tự này:
//
//   1. SIMPLIFY (mapshaper, Visvalingam, interval=25m) — bỏ bớt ĐỈNH của đường ranh giới.
//      Đây mới là thứ giảm tải thật: 512.755 → 60.602 điểm (÷8.5), 9.21 → 1.11 MB.
//   2. LÀM TRÒN toạ độ về 4 chữ số (~11 m) — chỉ cắt nhiễu dấu phẩy động, không bỏ điểm.
//
// ⚠️ VÌ SAO PHẢI DÙNG MAPSHAPER CHỨ KHÔNG TỰ VIẾT / KHÔNG DÙNG turf, simplify-js:
// mapshaper dựng TOPOLOGY trước khi simplify — biên chung giữa 2 xã liền kề là CÙNG một
// cung, được giản lược đúng một lần nên hai bên vẫn khớp nhau. Các thư viện simplify từng
// vòng polygon độc lập sẽ làm biên chung của 2 xã lệch nhau → hở khe / chồng lấn nhìn thấy
// được. Với 123 xã kề nhau khắp nơi thì đây là lỗi chắc chắn xảy ra, không phải giả thuyết.
//
// ⚠️ VÌ SAO SIMPLIFY PHẢI NẰM TRONG SCRIPT NÀY, KHÔNG LÀM TAY QUA mapshaper.org:
// script tự tải lại nguồn mỗi lần chạy. Nếu simplify bằng web tool rồi ghi đè file .geojson,
// lần sau ai đó chạy `npm run build:wards` (VD lúc bổ sung Đam Rông 2) là mất sạch phần
// simplify, không có cảnh báo nào — và bug "vỡ hình khi zoom" quay lại sau vài tuần,
// lúc đó không ai còn nhớ vì sao.
//
// ⚠️ SAI SỐ VÀ Ý NGHĨA CỦA NÓ: interval=25m nghĩa là đường ranh giới VẼ RA có thể lệch tối
// đa ~25 m so với dữ liệu gốc. Ở vĩ độ Lâm Đồng, 1 pixel ≈ 18.7 m tại zoom 13 — và
// useLeafletMap.ts ẩn hẳn lớp ranh giới từ zoom 14 trở lên, nên sai số này LUÔN dưới 1.3
// pixel ở mọi mức zoom mà ranh giới còn hiện: mắt thường không thể phân biệt.
// Quan trọng hơn: file này CHỈ để hiển thị. `ward_code` của mỗi SOS do trigger ST_Contains
// ở backend tự suy từ bảng `wards` (sinh riêng bởi gis/02-seed-wards.sql, GIỮ NGUYÊN độ
// chính xác gốc, KHÔNG simplify) — nên simplify ở đây không hề ảnh hưởng tới việc SOS được
// gán vào xã nào, cũng không ảnh hưởng việc điều đội (findNearestTeams tính theo khoảng
// cách GPS thật, không theo ranh giới xã).
//
// ⚠️ DỮ LIỆU THIẾU 1 ĐƠN VỊ: Lâm Đồng mới có 124 đơn vị cấp xã theo Nghị quyết
// 1671/NQ-UBTVQH15 (103 xã + 20 phường + 1 đặc khu, hiệu lực 16/6/2025), nhưng nguồn này
// chỉ có 123 — khuyết "Xã Đam Rông 2" (dataset có Đam Rông 1, 3, 4). Bảng `wards` trong
// DB cũng sinh ra từ đúng file này (xem gis/02-seed-wards.sql) nên cùng thiếu, tức bản đồ
// và DB vẫn nhất quán với nhau. Hệ quả cần biết: SOS gửi từ trong địa phận Đam Rông 2 sẽ
// không khớp ward nào qua ST_Contains → ward_code NULL → không vào được room ward tương
// ứng. Khi kiếm được ranh giới Đam Rông 2, bổ sung vào nguồn rồi chạy lại script này.

import mapshaper from 'mapshaper'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const NGUON_URL =
  'https://raw.githubusercontent.com/2314283-MVQuang/website-cuu-tro/main/public/data/lam_dong_data.json'

// 4 chữ số thập phân ≈ 11 m. Đừng hạ thêm: 3 chữ số (~111 m) bắt đầu thấy méo ranh giới.
const SO_CHU_SO = 4

// Sai số simplify tối đa, tính bằng MÉT (mapshaper dùng đơn vị mét cho dữ liệu chưa chiếu).
// Đo thật lúc chọn con số này (xem giải thích đầu file):
//   15m → 93.889 điểm / 1.71 MB    25m → 60.602 điểm / 1.11 MB
//   40m → 40.430 điểm / 0.75 MB   100m → 17.493 điểm / 0.34 MB
// 25m là điểm cân bằng: vẫn dưới 1.3 pixel ở zoom 13 (mức sâu nhất còn hiện ranh giới).
// Nếu tăng con số này, PHẢI xem lại ngưỡng ẩn ranh giới trong useLeafletMap.ts cho khớp.
const SAI_SO_MET = 25

// Số đơn vị hành chính kỳ vọng — xem ghi chú "thiếu Đam Rông 2" ở đầu file.
const SO_DON_VI_KY_VONG = 123

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
// Chỉ giữ toạ độ GỐC ở bước này — simplify chạy trên dữ liệu đầy đủ nhất để chọn điểm
// nào bỏ được cho chuẩn, làm tròn để sau cùng (xem thứ tự 1-2 giải thích ở đầu file).
const featuresGoc = geojson.features.map((f) => ({
  type: 'Feature',
  properties: {
    ma_xa: f.properties.ma_xa,
    ten_xa: f.properties.ten_xa,
    loai: f.properties.loai,
    sap_nhap: f.properties.sap_nhap,
    dtich_km2: f.properties.dtich_km2,
    dan_so: f.properties.dan_so
  },
  geometry: { type: f.geometry.type, coordinates: f.geometry.coordinates }
}))

const maTrung = featuresGoc.length - new Set(featuresGoc.map((f) => f.properties.ma_xa)).size
if (maTrung > 0) throw new Error(`Nguồn có ${maTrung} mã xã trùng nhau`)

// ---------- Bước 1: simplify (mapshaper, có dựng topology) ----------
// keep-shapes: KHÔNG được xoá hẳn một polygon dù nó nhỏ tới đâu. Thiếu cờ này, một
// phường diện tích nhỏ có thể biến mất im lặng khỏi bản đồ — kiểm tra ở dưới sẽ bắt được,
// nhưng chặn ngay từ đầu vẫn hơn là để nó xảy ra rồi mới báo lỗi.
const ketQuaSimplify = await mapshaper.applyCommands(
  `-i vao.json -simplify visvalingam interval=${SAI_SO_MET} keep-shapes -o ra.json`,
  { 'vao.json': JSON.stringify({ type: 'FeatureCollection', features: featuresGoc }) }
)
const featuresDaGon = JSON.parse(ketQuaSimplify['ra.json'].toString()).features

// ---------- Bước 2: làm tròn toạ độ ----------
// Chạy SAU simplify: hai xã kề nhau dùng chung đúng một cặp toạ độ nên làm tròn xong
// vẫn khớp nhau, không tạo khe hở.
const features = featuresDaGon.map((f) => ({
  type: 'Feature',
  properties: f.properties,
  geometry: { type: f.geometry.type, coordinates: lamTronToaDo(f.geometry.coordinates) }
}))

// ---------- Bước 3: KIỂM TRA — ném lỗi, không chỉ cảnh báo ----------
// Simplify là phép biến đổi mất mát: nó CÓ THỂ xoá nhầm cả một đơn vị hành chính hoặc để
// lại vòng polygon không hợp lệ. Không kiểm tự động ở đây thì lỗi chỉ lộ ra khi có người
// tình cờ nhận ra "sao xã X không có trên bản đồ" — có thể hàng tuần sau.
function demDiem(dsFeature) {
  let n = 0
  const di = (c) => (typeof c[0] === 'number' ? n++ : c.forEach(di))
  dsFeature.forEach((f) => di(f.geometry.coordinates))
  return n
}

// ⚠️ ĐÃ KIỂM CHỨNG BẰNG THỰC NGHIỆM: hai kiểm tra "đếm feature" và "thiếu mã xã" ngay dưới
// đây gần như KHÔNG BAO GIỜ kích hoạt khi cờ keep-shapes còn bật — chạy thử với
// SAI_SO_MET=20000 (20 km, ranh giới méo hoàn toàn) vẫn ra đủ 123 đơn vị và vẫn pass.
// Giữ chúng lại chỉ để bắt trường hợp ai đó gỡ mất keep-shapes. Guard THẬT SỰ có tác dụng
// là kiểm tra lệch diện tích ở phía dưới — đừng tin hai cái này là đủ.
if (features.length !== featuresGoc.length) {
  throw new Error(
    `Simplify làm mất đơn vị: ${featuresGoc.length} → ${features.length}. ` +
      `Nới SAI_SO_MET (đang ${SAI_SO_MET}m) hoặc kiểm tra lại cờ keep-shapes.`
  )
}

const maGoc = new Set(featuresGoc.map((f) => f.properties.ma_xa))
const maThieu = [...maGoc].filter((ma) => !features.some((f) => f.properties.ma_xa === ma))
if (maThieu.length > 0) {
  throw new Error(`Simplify làm mất mã xã: ${maThieu.join(', ')}`)
}

// Một vòng polygon hợp lệ cần tối thiểu 4 cặp toạ độ (điểm đầu trùng điểm cuối).
// Đây đúng là thứ simplify quá tay hay tạo ra: vòng còn 2-3 điểm, GeoJSON vẫn parse được
// nhưng Leaflet vẽ ra hình méo mó hoặc không vẽ gì.
for (const f of features) {
  const vong = []
  const gomVong = (c) => (typeof c[0][0] === 'number' ? vong.push(c) : c.forEach(gomVong))
  gomVong(f.geometry.coordinates)
  if (vong.length === 0) {
    throw new Error(`Xã ${f.properties.ma_xa} (${f.properties.ten_xa}) không còn vòng nào`)
  }
  for (const v of vong) {
    if (v.length < 4) {
      throw new Error(
        `Xã ${f.properties.ma_xa} (${f.properties.ten_xa}) có vòng chỉ ${v.length} điểm ` +
          `(tối thiểu 4). SAI_SO_MET=${SAI_SO_MET}m đang quá lớn.`
      )
    }
    if (v.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
      throw new Error(`Xã ${f.properties.ma_xa} có toạ độ không hợp lệ (NaN/Infinity)`)
    }
  }
}

// Guard thật: lệch DIỆN TÍCH từng xã so với dữ liệu gốc. Đây là thứ duy nhất trong các
// kiểm tra ở đây thực sự phân biệt được "simplify vừa phải" với "simplify hỏng hình".
// Số đo thật lúc chọn ngưỡng (shoelace trên toạ độ lat/lng, chỉ dùng để so tương đối):
//   interval=  25m → lệch tối đa  7.27%      interval= 100m → 23.37%
//   interval= 500m → 45.30%                  interval=20000m → 72.03%
// Ngưỡng 12% nằm gọn giữa mức đang dùng và mức bắt đầu hỏng. Xã nhỏ (đặc khu Phú Quý,
// Nam Dong) nhạy hơn hẳn với simplify nên luôn là ca xấu nhất — chỉnh ngưỡng thì nhìn
// vào chúng trước.
const LECH_DIEN_TICH_TOI_DA = 12

function dienTichTuongDoi(f) {
  let a = 0
  const vong = (r) => {
    for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      a += Math.abs((r[j][0] * r[i][1] - r[i][0] * r[j][1]) / 2)
    }
  }
  const di = (c) => (typeof c[0][0] === 'number' ? vong(c) : c.forEach(di))
  di(f.geometry.coordinates)
  return a
}

const dienTichGoc = new Map(featuresGoc.map((f) => [f.properties.ma_xa, dienTichTuongDoi(f)]))
let lechLonNhat = { pct: 0, ten: '', ma: '' }
for (const f of features) {
  const truoc = dienTichGoc.get(f.properties.ma_xa)
  if (!truoc) continue
  const pct = (Math.abs(dienTichTuongDoi(f) - truoc) / truoc) * 100
  if (pct > lechLonNhat.pct) {
    lechLonNhat = { pct, ten: f.properties.ten_xa, ma: f.properties.ma_xa }
  }
}
if (lechLonNhat.pct > LECH_DIEN_TICH_TOI_DA) {
  throw new Error(
    `Simplify làm méo hình: xã ${lechLonNhat.ma} (${lechLonNhat.ten}) lệch diện tích ` +
      `${lechLonNhat.pct.toFixed(2)}% > ngưỡng ${LECH_DIEN_TICH_TOI_DA}%. ` +
      `Giảm SAI_SO_MET (đang ${SAI_SO_MET}m).`
  )
}

const ketQua = {
  type: 'FeatureCollection',
  name: 'lamdong-wards',
  nguon: 'gis.vn — qua github.com/2314283-MVQuang/website-cuu-tro',
  simplify: `visvalingam interval=${SAI_SO_MET}m (mapshaper) — chỉ để hiển thị`,
  features
}

await mkdir(dirname(DUONG_DAN_RA), { recursive: true })
const noiDung = JSON.stringify(ketQua)
await writeFile(DUONG_DAN_RA, noiDung)

const theoLoai = features.reduce((acc, f) => {
  acc[f.properties.loai] = (acc[f.properties.loai] || 0) + 1
  return acc
}, {})
const diemGoc = demDiem(featuresGoc)
const diemCuoi = demDiem(features)

console.log(`Đã ghi: ${DUONG_DAN_RA}`)
console.log(`  ${features.length} đơn vị — ${JSON.stringify(theoLoai)}`)
console.log(
  `  ${diemGoc.toLocaleString('vi-VN')} → ${diemCuoi.toLocaleString('vi-VN')} điểm ` +
    `(÷${(diemGoc / diemCuoi).toFixed(1)}, sai số tối đa ~${SAI_SO_MET}m)`
)
console.log(`  ${(noiDung.length / 1024 / 1024).toFixed(2)} MB (làm tròn ${SO_CHU_SO} chữ số thập phân)`)
console.log(
  `  lệch diện tích lớn nhất ${lechLonNhat.pct.toFixed(2)}% ` +
    `(${lechLonNhat.ten}) — ngưỡng chặn ${LECH_DIEN_TICH_TOI_DA}%`
)
if (features.length !== SO_DON_VI_KY_VONG) {
  console.log(`  ⚠️ Số đơn vị khác ${SO_DON_VI_KY_VONG} so với lúc viết script — kiểm tra lại nguồn.`)
}
