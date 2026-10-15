import { describe, it, expect } from 'vitest'
import {
  layDiemNguyHiem,
  danhGiaTuyen,
  chonTuyenTranh,
  BAN_KINH_LU_M,
  BAN_KINH_SAT_LO_M,
  BAN_KINH_CHAY_M,
  BAN_KINH_CANH_BAO_M,
  BAN_KINH_BO_QUANH_DICH_M,
  type DiemNguyHiem
} from './diemNguyHiem'
import type { SosListItem, BaoCaoSuCo } from '@/types'

// Quy đổi mét ↔ độ quanh Đà Lạt (vĩ độ ~11.94°) để dựng dữ liệu cố định dễ đọc.
const LAT0 = 11.94
const LNG0 = 108.44
const MET_MOI_DO_VI = 111_320
const MET_MOI_DO_KINH = 111_320 * Math.cos((LAT0 * Math.PI) / 180)
const toaDo = (dongM: number, bacM: number) => ({ lat: LAT0 + bacM / MET_MOI_DO_VI, lng: LNG0 + dongM / MET_MOI_DO_KINH })

function sos(id: string, type: SosListItem['type'], status: SosListItem['status'], dongM: number, bacM: number): SosListItem {
  return {
    id, type, status, ward_code: '24781', created_at: '2026-10-02T08:00:00Z', location_estimated: false,
    victim_name: 'A', victim_phone: '0900000001', ...toaDo(dongM, bacM)
  }
}
function nguyHiem(dongM: number, bacM: number, banKinhM: number): DiemNguyHiem {
  return { ...toaDo(dongM, bacM), banKinhM, nguon: 'sos', loai: 'flood', nhan: 'Lũ lụt' }
}

describe('bán kính mặc định (GIẢ ĐỊNH, chờ duyệt)', () => {
  it('lũ 500 m, sạt lở 300 m, cháy 400 m, cảnh báo 300 m, bỏ quanh đích 300 m', () => {
    expect([BAN_KINH_LU_M, BAN_KINH_SAT_LO_M, BAN_KINH_CHAY_M, BAN_KINH_CANH_BAO_M, BAN_KINH_BO_QUANH_DICH_M])
      .toEqual([500, 300, 400, 300, 300])
  })
})

describe('layDiemNguyHiem', () => {
  const dich = { id: 'muc-tieu', ...toaDo(5000, 0) }

  it('chỉ lấy SOS đang hoạt động loại lũ/sạt lở/cháy, kèm bán kính theo loại', () => {
    const ds = layDiemNguyHiem({
      sosList: [
        sos('a', 'flood', 'pending', 0, 1000),
        sos('b', 'landslide', 'in_progress', 0, 2000),
        sos('c', 'fire', 'assigned', 0, 3000),
        sos('d', 'medical', 'pending', 0, 4000), // không phải thiên tai
        sos('e', 'flood', 'resolved', 0, 5000), // đã xong
        sos('f', 'flood', 'cancelled', 0, 6000)
      ],
      canhBao: [],
      mucTieu: dich
    })
    expect(ds.map((d) => [d.id, d.banKinhM])).toEqual([['a', 500], ['b', 300], ['c', 400]])
  })

  it('lấy cả điểm cảnh báo (bán kính 300 m), ghi rõ nguồn', () => {
    const canhBao: BaoCaoSuCo[] = [{ ten: 'Sạt lở đèo', ...toaDo(0, -2000), mucDo: 'Khẩn cấp', mau: '#a8462b' }]
    const ds = layDiemNguyHiem({ sosList: [], canhBao, mucTieu: dich })
    expect(ds).toHaveLength(1)
    expect(ds[0]).toMatchObject({ nguon: 'canh-bao', banKinhM: 300, nhan: 'Sạt lở đèo' })
  })

  it('bỏ chính SOS mục tiêu và mọi điểm trong 300 m quanh đích', () => {
    const ds = layDiemNguyHiem({
      sosList: [
        sos('muc-tieu', 'flood', 'assigned', 5000, 0),
        sos('sat-dich', 'landslide', 'pending', 5000, 250), // 250 m từ đích
        sos('xa-dich', 'landslide', 'pending', 5000, 350) // 350 m từ đích
      ],
      canhBao: [{ ten: 'Cảnh báo sát đích', ...toaDo(5100, 0), mucDo: 'Cảnh báo', mau: '#d99a35' }],
      mucTieu: dich
    })
    expect(ds.map((d) => d.id ?? d.nhan)).toEqual(['xa-dich'])
  })
})

describe('danhGiaTuyen', () => {
  // Tuyến thẳng 0 → 4000 m về phía đông.
  const tuyen = [toaDo(0, 0), toaDo(2000, 0), toaDo(4000, 0)]

  it('điểm nằm trên tuyến → bị cắt, khoảng cách ≈ 0', () => {
    const kq = danhGiaTuyen(tuyen, [nguyHiem(1000, 0, 300)])
    expect(kq.soDiemQua).toBe(1)
    expect(kq.khoangCachGanNhat).toBeLessThan(1)
  })

  it('điểm cạnh tuyến trong bán kính → bị cắt; ngoài bán kính → không, nhưng vẫn báo khoảng cách gần nhất', () => {
    const canh = nguyHiem(3000, 250, 300)
    const xa = nguyHiem(1000, 900, 300)
    const kq = danhGiaTuyen(tuyen, [xa, canh])
    expect(kq.soDiemQua).toBe(1)
    expect(kq.khoangCachGanNhat).toBeCloseTo(250, 0)
    expect(kq.diemGanNhat).toBe(canh)
  })

  it('điểm phía sau đầu tuyến: tính tới đầu mút, không tới đường kéo dài', () => {
    const kq = danhGiaTuyen(tuyen, [nguyHiem(-400, 0, 300)])
    expect(kq.soDiemQua).toBe(0)
    expect(kq.khoangCachGanNhat).toBeCloseTo(400, 0)
  })

  it('không có điểm nguy hiểm → 0 điểm, không có điểm gần nhất', () => {
    expect(danhGiaTuyen(tuyen, [])).toEqual({ soDiemQua: 0, khoangCachGanNhat: null, diemGanNhat: null })
  })
})

describe('chonTuyenTranh', () => {
  const nhanh = { ten: 'nhanh', toaDo: [toaDo(0, 0), toaDo(4000, 0)], thoiGianGiay: 300 }
  const vong = { ten: 'vong', toaDo: [toaDo(0, 0), toaDo(0, 1500), toaDo(4000, 1500), toaDo(4000, 0)], thoiGianGiay: 540 }
  const vong2 = { ten: 'vong2', toaDo: [toaDo(0, 0), toaDo(0, -1500), toaDo(4000, -1500), toaDo(4000, 0)], thoiGianGiay: 500 }

  it('chọn tuyến bị cắt ít điểm nhất dù chậm hơn → daTranh, không cảnh báo', () => {
    const kq = chonTuyenTranh([nhanh, vong], [nguyHiem(2000, 0, 500)])
    expect(kq?.tuyen.ten).toBe('vong')
    expect(kq?.daTranh).toBe(true)
    expect(kq?.soDiemTranh).toBe(1)
    expect(kq?.canhBao).toBeNull()
  })

  it('hoà số điểm → chọn tuyến nhanh hơn', () => {
    const kq = chonTuyenTranh([vong, vong2, nhanh], [nguyHiem(2000, 0, 500)])
    expect(kq?.tuyen.ten).toBe('vong2')
  })

  it('không có điểm nguy hiểm → tuyến nhanh nhất, không "đã tránh"', () => {
    const kq = chonTuyenTranh([vong, nhanh], [])
    expect(kq?.tuyen.ten).toBe('nhanh')
    expect(kq?.daTranh).toBe(false)
    expect(kq?.canhBao).toBeNull()
  })

  it('không phương án nào tránh được → vẫn chọn tuyến (nhanh nhất trong số ít điểm nhất) và có cảnh báo khoảng cách', () => {
    // Điểm sát đầu đích (4000, 0) — cả 2 tuyến đều phải đi qua.
    const diem = nguyHiem(3800, 100, 400)
    const kq = chonTuyenTranh([vong, nhanh], [diem])
    expect(kq?.tuyen.ten).toBe('nhanh')
    expect(kq?.daTranh).toBe(false)
    expect(kq?.canhBao).toMatchObject({ soDiemQua: 1, diemGanNhat: diem })
    expect(kq?.canhBao?.khoangCachM).toBeCloseTo(100, 0)
  })

  it('danh sách tuyến rỗng → null', () => {
    expect(chonTuyenTranh([], [])).toBeNull()
  })
})
