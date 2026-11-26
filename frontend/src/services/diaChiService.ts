// Tra TÊN ĐƯỜNG từ toạ độ (reverse geocode) cho thẻ SOS và ghim đặt cảnh báo — commander cần
// biết "đường nào" chứ không đọc được toạ độ thô.
//
// Gọi qua backend GET /api/geocode/reverse (CLAUDE.md 15.32), KHÔNG gọi thẳng Nominatim: DNS
// Viettel chặn cả tên miền openstreetmap.org (Mục 15.12), và toạ độ nạn nhân không nên rời trình
// duyệt tới bên thứ ba kèm IP của commander. Backend lo cache chung + giới hạn 1 yêu cầu/giây.
//  - cache theo toạ độ làm tròn 4 chữ số (~11 m), giữ cả kết quả null ("không có đường");
//  - gửi tuần tự từng yêu cầu: backend xếp hàng ~1 giây/yêu cầu, bắn song song 20 SOS thì yêu
//    cầu cuối chờ quá hạn timeout của http;
//  - lỗi/mất mạng → null, bỏ khỏi cache để lần sau thử lại. Không toast: chỉ là thông tin phụ.

import { http } from '@/services/http'
import { CONFIG } from '@/config'

const TIMEOUT_MS = 15000

const cache = new Map<string, Promise<string | null>>()
let hangDoi: Promise<unknown> = Promise.resolve()

interface PhanHoi {
  data: { tenDuong: string | null }
}

export function layTenDuong(lat: number, lng: number): Promise<string | null> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return Promise.resolve(null)
  const khoa = `${lat.toFixed(4)},${lng.toFixed(4)}`
  const daCo = cache.get(khoa)
  if (daCo) return daCo
  const viec = hangDoi.then(async () => {
    const { data } = await http.get<PhanHoi>(CONFIG.endpoints.geocodeReverse, {
      params: { lat, lng },
      timeout: TIMEOUT_MS,
      khongHienToastLoi: true
    })
    return data.data.tenDuong ?? null
  })
  hangDoi = viec.catch(() => null)
  const ketQua = viec.catch(() => {
    cache.delete(khoa)
    return null
  })
  cache.set(khoa, ketQua)
  return ketQua
}
