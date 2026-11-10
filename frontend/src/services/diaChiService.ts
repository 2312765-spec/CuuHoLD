// Tra TÊN ĐƯỜNG từ toạ độ (reverse geocode) cho thẻ SOS và ghim đặt cảnh báo — commander cần
// biết "đường nào" chứ không đọc được toạ độ thô. Dùng Nominatim (OpenStreetMap, cùng nguồn dữ
// liệu với nền bản đồ), gọi thẳng từ trình duyệt: không cần khoá, không qua backend.
//
// Chính sách sử dụng Nominatim: tối đa 1 yêu cầu/giây, phải cache kết quả. Nên ở đây:
//  - hàng đợi tuần tự, mỗi yêu cầu cách nhau ≥ 1.1 giây;
//  - cache theo toạ độ làm tròn 4 chữ số (~11 m) — cùng một SOS không bao giờ hỏi lại;
//  - lỗi/mất mạng → trả null, nơi gọi hiện tên xã thay thế. Không toast: đây chỉ là thông tin
//    phụ, SOS vẫn xử lý được bình thường không cần tên đường.
// Triển khai thật nhiều commander cùng lúc nên chuyển sang máy chủ Nominatim riêng hoặc gọi qua
// backend có cache chung (ghi trong CLAUDE.md).

const URL_NOMINATIM = 'https://nominatim.openstreetmap.org/reverse'
const KHOANG_CACH_MS = 1100
const TIMEOUT_MS = 8000

const cache = new Map<string, Promise<string | null>>()
let hangDoi: Promise<unknown> = Promise.resolve()

interface PhanHoiNominatim {
  address?: Record<string, string | undefined>
}

// Ưu tiên tên đường; không có đường (giữa rừng, ruộng) thì lùi về thôn/khu phố gần nhất.
export function tenDuongTuDiaChi(addr: Record<string, string | undefined> | undefined): string | null {
  if (!addr) return null
  const duong = addr.road ?? addr.pedestrian ?? addr.footway ?? addr.path ?? addr.track
  if (duong) return addr.house_number ? `${addr.house_number} ${duong}` : duong
  const khuVuc = addr.hamlet ?? addr.neighbourhood ?? addr.quarter ?? addr.village ?? addr.suburb
  return khuVuc ? `Gần ${khuVuc}` : null
}

function cho(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function goiNominatim(lat: number, lng: number): Promise<string | null> {
  const ctrl = new AbortController()
  const hen = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const params = new URLSearchParams({
      format: 'jsonv2',
      lat: String(lat),
      lon: String(lng),
      zoom: '17',
      'accept-language': 'vi'
    })
    const res = await fetch(`${URL_NOMINATIM}?${params}`, { signal: ctrl.signal })
    if (!res.ok) return null
    const json = (await res.json()) as PhanHoiNominatim
    return tenDuongTuDiaChi(json.address)
  } catch {
    return null
  } finally {
    clearTimeout(hen)
  }
}

export function layTenDuong(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null)
  const khoa = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const daCo = cache.get(khoa)
  if (daCo) return daCo
  const ketQua = hangDoi.then(async () => {
    const ten = await goiNominatim(lat, lng)
    await cho(KHOANG_CACH_MS)
    return ten
  })
  hangDoi = ketQua.catch(() => null)
  // Lỗi mạng thì bỏ khỏi cache để lần sau (có mạng lại) thử lại được.
  const coXoa = ketQua.then((ten) => {
    if (ten === null) cache.delete(khoa)
    return ten
  })
  cache.set(khoa, coXoa)
  return coXoa
}
