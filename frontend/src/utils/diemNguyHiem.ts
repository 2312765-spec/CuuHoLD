// Điểm thiên tai cần tránh khi chọn tuyến đường bộ tới nạn nhân (bước 1: chỉ phần tính toán
// thuần — CHƯA nối vào luồng định tuyến, đồng đội đang làm phần "đường đi đường bộ").
//
// Giới hạn thật, nói rõ để UI không hứa quá: máy chủ định tuyến (VD OSRM) không nhận "vùng cấm"
// tuỳ ý, nên "né" ở đây = chọn trong VÀI tuyến thay thế mà máy chủ trả về + cảnh báo nếu tuyến
// chọn vẫn đi gần điểm nguy hiểm. KHÔNG bao giờ được gọi tuyến nào là "an toàn": dữ liệu điểm
// nguy hiểm không đầy đủ (chỉ những gì đã được báo), và cảnh báo ở FE hiện là dữ liệu minh hoạ.
import { khoangCachMet, type ToaDo } from '@/utils/geo'
import type { SosListItem, SosType, SosStatus, BaoCaoSuCo } from '@/types'

// ⚠️ GIẢ ĐỊNH — chờ duyệt (chưa có nguồn chính thức): bán kính ảnh hưởng quanh điểm báo.
// Lũ lan rộng theo vùng trũng nên lớn nhất; cháy rừng có khói + lửa lan; sạt lở thường cục bộ
// một đoạn đường; điểm cảnh báo không rõ loại dùng mức của sạt lở.
export const BAN_KINH_LU_M = 500
export const BAN_KINH_SAT_LO_M = 300
export const BAN_KINH_CHAY_M = 400
export const BAN_KINH_CANH_BAO_M = 300
// Điểm nguy hiểm sát đích thì tuyến nào cũng phải tới — đó chính là nơi đội cần đến (VD các
// SOS lũ khác cùng khu ngập), tính vào chỉ làm mọi tuyến "bị cắt" như nhau và cảnh báo vô ích.
export const BAN_KINH_BO_QUANH_DICH_M = 300

const BAN_KINH_THEO_LOAI: Partial<Record<SosType, number>> = {
  flood: BAN_KINH_LU_M,
  landslide: BAN_KINH_SAT_LO_M,
  fire: BAN_KINH_CHAY_M
}
const NHAN_THEO_LOAI: Partial<Record<SosType, string>> = { flood: 'Lũ lụt', landslide: 'Sạt lở', fire: 'Cháy' }
// SOS còn đang diễn ra — SOS đã xong/huỷ không còn là điểm nguy hiểm đang có.
const TRANG_THAI_DANG_HOAT_DONG: SosStatus[] = ['pending', 'assigned', 'in_progress', 'arrived']

export interface DiemNguyHiem extends ToaDo {
  banKinhM: number
  nguon: 'sos' | 'canh-bao'
  loai: SosType | 'canh-bao'
  nhan: string
  id?: string
}

export function layDiemNguyHiem(dauVao: {
  sosList: SosListItem[]
  canhBao: BaoCaoSuCo[]
  mucTieu: ToaDo & { id?: string }
}): DiemNguyHiem[] {
  const { sosList, canhBao, mucTieu } = dauVao
  const tuSos: DiemNguyHiem[] = []
  for (const s of sosList) {
    const banKinhM = BAN_KINH_THEO_LOAI[s.type]
    if (!banKinhM || s.id === mucTieu.id || !TRANG_THAI_DANG_HOAT_DONG.includes(s.status)) continue
    tuSos.push({ lat: s.lat, lng: s.lng, banKinhM, nguon: 'sos', loai: s.type, nhan: NHAN_THEO_LOAI[s.type] ?? s.type, id: s.id })
  }
  const tuCanhBao: DiemNguyHiem[] = canhBao.map((c) => ({
    lat: c.lat, lng: c.lng, banKinhM: BAN_KINH_CANH_BAO_M, nguon: 'canh-bao', loai: 'canh-bao', nhan: c.ten
  }))
  return [...tuSos, ...tuCanhBao].filter((d) => khoangCachMet(d, mucTieu) > BAN_KINH_BO_QUANH_DICH_M)
}

const MET_MOI_DO = (6_371_000 * Math.PI) / 180

// Khoảng cách (m) từ điểm p tới đoạn a–b. Chiếu phẳng cục bộ quanh p (đủ chính xác ở vài km,
// đúng tầm cần xét quanh một điểm nguy hiểm) rồi tính khoảng cách điểm–đoạn trên mặt phẳng.
function khoangCachToiDoanM(p: ToaDo, a: ToaDo, b: ToaDo): number {
  const kx = MET_MOI_DO * Math.cos((p.lat * Math.PI) / 180)
  const ax = (a.lng - p.lng) * kx
  const ay = (a.lat - p.lat) * MET_MOI_DO
  const bx = (b.lng - p.lng) * kx
  const by = (b.lat - p.lat) * MET_MOI_DO
  const dx = bx - ax
  const dy = by - ay
  const dai2 = dx * dx + dy * dy
  // t: vị trí hình chiếu của p trên đoạn, kẹp [0, 1] để tính tới đầu mút chứ không tới đường kéo dài.
  const t = dai2 === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / dai2))
  return Math.hypot(ax + t * dx, ay + t * dy)
}

function khoangCachToiTuyenM(p: ToaDo, tuyen: ToaDo[]): number {
  if (tuyen.length === 1) return khoangCachMet(p, tuyen[0])
  let min = Infinity
  for (let i = 1; i < tuyen.length; i++) min = Math.min(min, khoangCachToiDoanM(p, tuyen[i - 1], tuyen[i]))
  return min
}

export interface DanhGiaTuyen {
  // Số điểm nguy hiểm mà tuyến đi vào trong bán kính.
  soDiemQua: number
  khoangCachGanNhat: number | null
  diemGanNhat: DiemNguyHiem | null
}

export function danhGiaTuyen(tuyen: ToaDo[], diemNguyHiem: DiemNguyHiem[]): DanhGiaTuyen {
  let soDiemQua = 0
  let khoangCachGanNhat: number | null = null
  let diemGanNhat: DiemNguyHiem | null = null
  if (tuyen.length === 0) return { soDiemQua, khoangCachGanNhat, diemGanNhat }
  for (const d of diemNguyHiem) {
    const kc = khoangCachToiTuyenM(d, tuyen)
    if (kc <= d.banKinhM) soDiemQua++
    if (khoangCachGanNhat === null || kc < khoangCachGanNhat) {
      khoangCachGanNhat = kc
      diemGanNhat = d
    }
  }
  return { soDiemQua, khoangCachGanNhat, diemGanNhat }
}

export interface TuyenUngVien {
  toaDo: ToaDo[]
  thoiGianGiay: number
}

export interface KetQuaChonTuyen<T extends TuyenUngVien> {
  tuyen: T
  // Tuyến chọn đi qua ít điểm nguy hiểm hơn tuyến nhanh nhất (đã đổi tuyến để tránh).
  daTranh: boolean
  // Số điểm tránh được so với tuyến nhanh nhất — cho huy hiệu "Tránh N điểm thiên tai".
  soDiemTranh: number
  // Tuyến chọn VẪN đi gần điểm nguy hiểm → UI phải cảnh báo "kiểm tra thực địa".
  canhBao: { soDiemQua: number; diemGanNhat: DiemNguyHiem | null; khoangCachM: number | null } | null
}

// Ít điểm bị cắt nhất; hoà thì nhanh hơn. Không có tuyến → null.
export function chonTuyenTranh<T extends TuyenUngVien>(
  cacTuyen: T[],
  diemNguyHiem: DiemNguyHiem[]
): KetQuaChonTuyen<T> | null {
  if (cacTuyen.length === 0) return null
  const danhGia = cacTuyen.map((tuyen) => ({ tuyen, dg: danhGiaTuyen(tuyen.toaDo, diemNguyHiem) }))
  const nhanhNhat = danhGia.reduce((a, b) => (b.tuyen.thoiGianGiay < a.tuyen.thoiGianGiay ? b : a))
  const chon = danhGia.reduce((a, b) =>
    b.dg.soDiemQua < a.dg.soDiemQua ||
    (b.dg.soDiemQua === a.dg.soDiemQua && b.tuyen.thoiGianGiay < a.tuyen.thoiGianGiay)
      ? b
      : a
  )
  const soDiemTranh = nhanhNhat.dg.soDiemQua - chon.dg.soDiemQua
  return {
    tuyen: chon.tuyen,
    daTranh: soDiemTranh > 0,
    soDiemTranh,
    canhBao:
      chon.dg.soDiemQua > 0
        ? { soDiemQua: chon.dg.soDiemQua, diemGanNhat: chon.dg.diemGanNhat, khoangCachM: chon.dg.khoangCachGanNhat }
        : null
  }
}
