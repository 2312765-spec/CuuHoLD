// Tải sẵn tile nền Lâm Đồng z8–10 vào public/tiles/{z}/{x}/{y}.png để Workbox precache
// (SRS F-PWA-03 — bản đồ offline). Xem giải thích đầy đủ về phạm vi và lý do trong
// src/constants/tileProvider.ts (mục "BẢN ĐỒ OFFLINE").
//
// CHẠY:  npm run build:tiles
//        npm run build:tiles -- --force    (tải lại cả tile đã có)
//
// CHẠY KHI NÀO: chỉ khi muốn làm mới dữ liệu nền (OSM cập nhật đường/địa danh). Không cần
// chạy trong quy trình build thường ngày — kết quả đã commit sẵn vào repo.
//
// ⚠️ ĐÂY LÀ SCRIPT CHẠY LÚC PHÁT TRIỂN, KHÔNG PHẢI LÚC NGƯỜI DÙNG CHẠY APP. Cả tính năng
// này tồn tại chính vì lý do đó: OSM đã từng chặn thật app này, nên không được để mỗi lần
// cài app lại tự bắn ~96 request lên server tình nguyện của họ. Chạy 1 lần ở đây = 1 lần
// duy nhất, không nhân theo số người dùng.
//
// ⚠️ CẠM BẪY ĐÃ GẶP THẬT, ĐỪNG BỎ PHÉP KIỂM BÊN DƯỚI: khi OSM chặn, họ KHÔNG trả mã lỗi —
// họ trả HTTP 200 + một ảnh PNG hợp lệ ghi chữ "Access blocked". Script nào chỉ kiểm
// `res.ok` sẽ vui vẻ lưu 96 bản sao của tấm ảnh chặn đó rồi commit vào repo.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  TILE_URL,
  OFFLINE_TILE_MIN_ZOOM,
  OFFLINE_TILE_MAX_ZOOM,
  OFFLINE_TILE_PADDING,
  LAMDONG_BBOX,
  tileX,
  tileY
} from '../src/constants/tileProvider.ts'

const THU_MUC_GOC = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const THU_MUC_RA = resolve(THU_MUC_GOC, 'public/tiles')
const DUONG_DAN_GEOJSON = resolve(THU_MUC_GOC, 'public/data/lamdong-wards.geojson')

// OSM Tile Usage Policy YÊU CẦU User-Agent định danh được. User-Agent chung chung kiểu
// "Mozilla/5.0" chính là thứ khiến họ trả ảnh "Access blocked" khi thử nghiệm trước đó.
const USER_AGENT = 'RescueGIS-LamDong/1.0 (do an sinh vien; lien he qua repo)'

// Nghỉ giữa các request. 96 tile × 250ms ≈ 24 giây — chậm có chủ đích, để lượt tải này
// không giống một đợt quét hàng loạt.
const NGHI_MS = 250

const force = process.argv.includes('--force')
const ngu = (ms) => new Promise((r) => setTimeout(r, ms))
const tonTai = (p) =>
  access(p).then(
    () => true,
    () => false
  )

// ---------- Kiểm tra bbox hardcode vẫn phủ hết dữ liệu ranh giới thật ----------
// Nếu nguồn wards đổi (thêm Đam Rông 2, đổi ranh giới hành chính...) mà bbox trong
// tileProvider.ts không được cập nhật theo, phần rìa tỉnh sẽ thiếu tile offline mà không
// ai biết. Bắt lỗi ngay ở đây thay vì để lộ ra lúc mất mạng ngoài thực địa.
const geojson = JSON.parse(await readFile(DUONG_DAN_GEOJSON, 'utf8'))
let mnx = 180
let mny = 90
let mxx = -180
let mxy = -90
const duyet = (c) =>
  typeof c[0] === 'number'
    ? ((mnx = Math.min(mnx, c[0])),
      (mxx = Math.max(mxx, c[0])),
      (mny = Math.min(mny, c[1])),
      (mxy = Math.max(mxy, c[1])))
    : c.forEach(duyet)
geojson.features.forEach((f) => duyet(f.geometry.coordinates))

if (
  LAMDONG_BBOX.minLng > mnx ||
  LAMDONG_BBOX.minLat > mny ||
  LAMDONG_BBOX.maxLng < mxx ||
  LAMDONG_BBOX.maxLat < mxy
) {
  throw new Error(
    `LAMDONG_BBOX trong tileProvider.ts KHÔNG còn phủ hết ranh giới thật.\n` +
      `  bbox geojson: ${mnx.toFixed(4)}, ${mny.toFixed(4)} → ${mxx.toFixed(4)}, ${mxy.toFixed(4)}\n` +
      `  LAMDONG_BBOX: ${LAMDONG_BBOX.minLng}, ${LAMDONG_BBOX.minLat} → ${LAMDONG_BBOX.maxLng}, ${LAMDONG_BBOX.maxLat}`
  )
}

// ---------- Dựng danh sách tile cần tải ----------
const danhSach = []
for (let z = OFFLINE_TILE_MIN_ZOOM; z <= OFFLINE_TILE_MAX_ZOOM; z++) {
  // Cùng công thức với duongDanTileOffline() trong tileProvider.ts — nếu lệch nhau thì app
  // sẽ trỏ tới file không tồn tại (404) hoặc bỏ phí tile đã tải. Đó là lý do padding/bbox
  // nằm chung một chỗ chứ không khai lại ở đây.
  const p = OFFLINE_TILE_PADDING[z] ?? 0
  const x0 = tileX(LAMDONG_BBOX.minLng, z) - p
  const x1 = tileX(LAMDONG_BBOX.maxLng, z) + p
  const y0 = tileY(LAMDONG_BBOX.maxLat, z) - p
  const y1 = tileY(LAMDONG_BBOX.minLat, z) + p
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) danhSach.push({ z, x, y })
}

console.log(`Cần ${danhSach.length} tile (z${OFFLINE_TILE_MIN_ZOOM}–${OFFLINE_TILE_MAX_ZOOM}), nghỉ ${NGHI_MS}ms giữa mỗi request`)

// ---------- Tải ----------
// Cố định 1 subdomain thay vì XOÁ {s}: script tải tuần tự nên không cần chia subdomain,
// nhưng KHÔNG được bỏ hẳn — host trần tile.openstreetmap.fr/hot/ trả 404 (kiểm chứng
// 2026-09-13), chỉ a/b/c mới phục vụ tile. ⚠️ Bộ tile hiện có trong public/tiles/ được tải
// từ tile.openstreetmap.org TRƯỚC khi đổi nguồn; chạy lại script sẽ tải từ TILE_URL mới.
const MAU_URL = TILE_URL.replace('{s}', 'a')

let daTai = 0
let boQua = 0
const bam = new Map() // hash → { soLan, bytes } — dùng để phát hiện ảnh chặn hàng loạt

for (const { z, x, y } of danhSach) {
  const duongDan = resolve(THU_MUC_RA, String(z), String(x), `${y}.png`)

  if (!force && (await tonTai(duongDan))) {
    const cu = await readFile(duongDan)
    const h = createHash('sha1').update(cu).digest('hex')
    bam.set(h, { soLan: (bam.get(h)?.soLan ?? 0) + 1, bytes: cu.length })
    boQua++
    continue
  }

  const url = MAU_URL.replace('{z}', z).replace('{x}', x).replace('{y}', y)
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!res.ok) throw new Error(`Tải thất bại ${url} — HTTP ${res.status}`)

  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length < 100) throw new Error(`Tile quá nhỏ, nhiều khả năng không hợp lệ: ${url} (${buf.length} bytes)`)
  // Chữ ký 8 byte đầu của mọi file PNG hợp lệ.
  if (buf.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new Error(`Phản hồi không phải PNG: ${url}`)
  }

  const h = createHash('sha1').update(buf).digest('hex')
  bam.set(h, { soLan: (bam.get(h)?.soLan ?? 0) + 1, bytes: buf.length })

  await mkdir(dirname(duongDan), { recursive: true })
  await writeFile(duongDan, buf)
  daTai++
  await ngu(NGHI_MS)
}

// ---------- Phát hiện ảnh "Access blocked" ----------
// Tile bản đồ CÓ NỘI DUNG ở các toạ độ khác nhau gần như không bao giờ trùng byte-for-byte.
// Nếu một nội dung như vậy lặp lại nhiều lần thì gần như chắc chắn ta đang lưu ảnh chặn của
// OSM chứ không phải bản đồ. Kiểm theo hash chứ không hardcode kích thước/hash của ảnh chặn
// hiện tại — để vẫn bắt được nếu OSM đổi hình.
//
// ⚠️ PHẢI BỎ QUA TILE NHỎ, nếu không guard này sẽ báo động giả: ô biển ngoài khơi Bình Thuận
// là màu xanh đặc, CHỈ 103 byte, và mọi ô biển đều giống hệt nhau — hoàn toàn hợp lệ. Lần
// chạy thật có 22/154 ô như vậy (14%); nới padding thêm là tỷ lệ này còn tăng nữa. Guard hay
// báo nhầm là guard sẽ bị xoá, nên nó chỉ soi những tile đủ lớn để thật sự có nội dung.
const NGUONG_CO_NOI_DUNG_BYTE = 1000
const bamCoNoiDung = new Map()
for (const [h, info] of bam) if (info.bytes >= NGUONG_CO_NOI_DUNG_BYTE) bamCoNoiDung.set(h, info.soLan)

const [hashNhieuNhat, soLan] = [...bamCoNoiDung.entries()].sort((a, b) => b[1] - a[1])[0] ?? ['', 0]
if (soLan > 3) {
  throw new Error(
    `${soLan} tile CÓ NỘI DUNG giống hệt nhau (sha1 ${hashNhieuNhat.slice(0, 12)}) — gần như chắc ` +
      `chắn đây là ảnh "Access blocked" của OSM, KHÔNG phải bản đồ thật. ` +
      `Xoá public/tiles/ rồi thử lại sau, ĐỪNG commit.`
  )
}

console.log(`Đã ghi: ${THU_MUC_RA}`)
console.log(`  tải mới ${daTai}, bỏ qua (đã có) ${boQua}`)
console.log(`  tile CÓ NỘI DUNG trùng nhau nhiều nhất: ${soLan} (ngưỡng chặn: >3)`)
console.log(`  (ô biển/ô trống giống hệt nhau là bình thường, đã bỏ qua khỏi phép kiểm này)`)
