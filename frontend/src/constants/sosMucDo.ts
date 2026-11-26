// Mức độ nghiêm trọng của SOS — để Bảng điều phối xếp ca gấp nhất lên đầu và tô màu thẻ.
// Backend KHÔNG có cột mức độ (sos_requests chỉ có `type`), nên mức độ suy ra từ LOẠI sự cố theo
// bảng dưới. Đây là quy ước của frontend, đổi ở đúng một chỗ này nếu nhóm muốn xếp khác.
//   Nguy kịch: đe doạ tính mạng trong vài phút (đuối nước, cháy, sạt lở vùi lấp).
//   Nặng:      có thể nguy hiểm tính mạng nếu chậm (lũ, y tế khẩn cấp, tai nạn).
//   Vừa:       cần cứu nhưng còn thời gian (lạc đường, tai nạn dã ngoại).
//   Nhẹ:       còn lại.

import type { SosListItem, SosStatus, SosType } from '@/types'

export type MucDoSos = 'nguy-kich' | 'nang' | 'vua' | 'nhe'

export const MUC_DO_THEO_LOAI: Record<SosType, MucDoSos> = {
  drowning: 'nguy-kich',
  fire: 'nguy-kich',
  landslide: 'nguy-kich',
  flood: 'nang',
  medical: 'nang',
  accident: 'nang',
  lost: 'vua',
  adventure: 'vua',
  agricultural: 'nhe',
  other: 'nhe'
}

export const NHAN_MUC_DO: Record<MucDoSos, string> = {
  'nguy-kich': 'Nguy kịch',
  nang: 'Nặng',
  vua: 'Vừa',
  nhe: 'Nhẹ'
}

const HANG_MUC_DO: Record<MucDoSos, number> = { 'nguy-kich': 0, nang: 1, vua: 2, nhe: 3 }

// SOS đã kết thúc không cần ai xử lý nữa — luôn xuống cuối dù loại nghiêm trọng tới đâu.
const DA_KET_THUC: ReadonlySet<SosStatus> = new Set(['resolved', 'cancelled', 'false_alarm'])

export function mucDoSos(type: SosType): MucDoSos {
  return MUC_DO_THEO_LOAI[type] ?? 'nhe'
}

export function laSosDaKetThuc(status: SosStatus): boolean {
  return DA_KET_THUC.has(status)
}

export type CachSapXepSos = 'khan-cap' | 'moi-nhat' | 'cho-lau-nhat'

export const NHAN_CACH_SAP_XEP: Record<CachSapXepSos, string> = {
  'khan-cap': 'Khẩn cấp nhất',
  'moi-nhat': 'Mới nhất',
  'cho-lau-nhat': 'Chờ lâu nhất'
}

function thoiGian(s: SosListItem): number {
  return new Date(s.created_at).getTime() || 0
}

// Trả MẢNG MỚI (không sắp xếp tại chỗ danh sách gốc mà socket đang cập nhật).
export function sapXepSos(ds: readonly SosListItem[], cach: CachSapXepSos): SosListItem[] {
  return [...ds].sort((a, b) => {
    // Ca chưa kết thúc luôn đứng trước ca đã kết thúc, với mọi cách sắp xếp.
    const ketThuc = Number(laSosDaKetThuc(a.status)) - Number(laSosDaKetThuc(b.status))
    if (ketThuc !== 0) return ketThuc
    if (cach === 'moi-nhat') return thoiGian(b) - thoiGian(a)
    if (cach === 'cho-lau-nhat') return thoiGian(a) - thoiGian(b)
    const mucDo = HANG_MUC_DO[mucDoSos(a.type)] - HANG_MUC_DO[mucDoSos(b.type)]
    if (mucDo !== 0) return mucDo
    // Cùng mức độ: ca chưa có đội nhận (pending) lên trước, rồi tới ca mới nhất.
    const choXuLy = Number(b.status === 'pending') - Number(a.status === 'pending')
    if (choXuLy !== 0) return choXuLy
    return thoiGian(b) - thoiGian(a)
  })
}
