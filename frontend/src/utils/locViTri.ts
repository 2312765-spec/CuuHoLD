// Lọc nhiễu điểm GPS cho nút "Vị trí của tôi" — CHỈ dùng để HIỂN THỊ trên máy người dùng.
// Không áp cho vị trí gửi đi (SOS, cập nhật vị trí đội): những luồng đó giữ GPS thật, việc
// bỏ điểm ở đây chỉ nhằm chấm xanh trên bản đồ không nhảy lung tung.
import { khoangCachMet } from '@/utils/geo'

export interface DiemGps {
  lat: number
  lng: number
  // Sai số ước tính (mét, coords.accuracy). null = trình duyệt không cho biết.
  saiSoM: number | null
  // Mốc thời gian (ms) của điểm — dùng tính vận tốc.
  thoiDiem: number
}

// Sai số trên ngưỡng này coi là điểm kém (định vị theo trạm phát sóng/Wi-Fi thô): chỉ bỏ khi
// gần đây đã có điểm tốt hơn — không có gì tốt hơn thì điểm kém vẫn hơn là không hiện gì.
export const NGUONG_SAI_SO_BO_M = 200
// "Gần đây" = 30 giây: quá lâu thì điểm tốt cũ có thể đã sai vì người dùng đã đi chỗ khác.
export const CUA_SO_SO_SANH_MS = 30_000
// Đi đường bộ ở Lâm Đồng (đèo, đường đồi) không vượt 150 km/h — nhanh hơn là GPS nhảy.
export const VAN_TOC_TOI_DA_KMH = 150
// Bị coi là "nhảy" liên tiếp chừng này lần thì điểm CŨ mới là điểm sai (VD điểm đầu tiên lệch
// mà sai số khai báo nhỏ) — chấp nhận điểm mới để không kẹt mãi ở vị trí sai.
export const SO_LAN_NHAY_LIEN_TIEP_TOI_DA = 3

// Đổi kết quả của trình duyệt sang DiemGps. accuracy không phải số (máy/trình duyệt lạ, dữ liệu
// giả lập thiếu trường) → null = "không rõ sai số", thay vì để NaN lọt vào vòng sai số.
export function diemTuViTriTrinhDuyet(pos: GeolocationPosition): DiemGps {
  return {
    lat: pos.coords.latitude,
    lng: pos.coords.longitude,
    saiSoM: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
    thoiDiem: pos.timestamp || Date.now()
  }
}

export type KetQuaLoc = { nhan: true } | { nhan: false; lyDo: 'sai-so-lon' | 'nhay-bat-thuong' }

export function taoBoLocViTri() {
  // Các điểm ĐÃ NHẬN trong cửa sổ so sánh, cũ → mới.
  let lichSu: DiemGps[] = []
  let soLanNhay = 0

  function ghiNhan(moi: DiemGps): KetQuaLoc {
    lichSu = [...lichSu.filter((d) => moi.thoiDiem - d.thoiDiem <= CUA_SO_SO_SANH_MS), moi]
    soLanNhay = 0
    return { nhan: true }
  }

  function nhan(moi: DiemGps): KetQuaLoc {
    const truoc = lichSu[lichSu.length - 1]
    if (!truoc) return ghiNhan(moi)

    const saiSoMoi = moi.saiSoM
    if (saiSoMoi !== null && saiSoMoi > NGUONG_SAI_SO_BO_M) {
      const coDiemTotHon = lichSu.some(
        (d) => moi.thoiDiem - d.thoiDiem <= CUA_SO_SO_SANH_MS && d.saiSoM !== null && d.saiSoM < saiSoMoi
      )
      if (coDiemTotHon) return { nhan: false, lyDo: 'sai-so-lon' }
    }

    // Trừ sai số 2 điểm khỏi khoảng cách: từ điểm Wi-Fi sai số 1 km sang điểm GPS chuẩn cách
    // 800 m chỉ là "chính xác hơn", không phải di chuyển — tính thô sẽ bỏ đúng điểm tốt nhất.
    const quangDuongM = Math.max(0, khoangCachMet(truoc, moi) - (truoc.saiSoM ?? 0) - (moi.saiSoM ?? 0))
    const gio = Math.max(moi.thoiDiem - truoc.thoiDiem, 1000) / 3_600_000
    if (quangDuongM / 1000 / gio > VAN_TOC_TOI_DA_KMH) {
      soLanNhay++
      if (soLanNhay < SO_LAN_NHAY_LIEN_TIEP_TOI_DA) return { nhan: false, lyDo: 'nhay-bat-thuong' }
      lichSu = []
    }
    return ghiNhan(moi)
  }

  function xoa(): void {
    lichSu = []
    soLanNhay = 0
  }

  return { nhan, xoa }
}
