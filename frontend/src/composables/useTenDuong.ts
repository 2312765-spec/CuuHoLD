// Giữ tên đường đã tra cho từng toạ độ ở dạng phản ứng, để thẻ SOS tự hiện tên đường khi tra
// xong. Gọi yeuCau() cho những điểm đang hiển thị; tenDuong() trả:
//   undefined = chưa tra / đang tra, null = không tra được (mất mạng, giữa rừng...), string = tên.

import { reactive } from 'vue'
import { layTenDuong } from '@/services/diaChiService'

function khoa(lat: number, lng: number): string {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

export function useTenDuong() {
  const ketQua = reactive(new Map<string, string | null>())
  const dangTra = new Set<string>()

  function yeuCau(lat: number, lng: number): void {
    const k = khoa(lat, lng)
    if (ketQua.has(k) || dangTra.has(k)) return
    dangTra.add(k)
    void layTenDuong(lat, lng).then((ten) => {
      dangTra.delete(k)
      ketQua.set(k, ten)
    })
  }

  function tenDuong(lat: number, lng: number): string | null | undefined {
    return ketQua.get(khoa(lat, lng))
  }

  return { yeuCau, tenDuong }
}
