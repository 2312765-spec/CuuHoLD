import { describe, it, expect } from 'vitest'
import {
  taoBoLocViTri,
  NGUONG_SAI_SO_BO_M,
  CUA_SO_SO_SANH_MS,
  VAN_TOC_TOI_DA_KMH,
  SO_LAN_NHAY_LIEN_TIEP_TOI_DA,
  type DiemGps
} from './locViTri'

// Độ dài 1 độ vĩ ≈ 111 320 m — dùng để dựng điểm cách nhau đúng số mét mong muốn.
const MET_MOI_DO_VI = 111_320
function diem(dichBacMet: number, saiSoM: number | null, giay: number): DiemGps {
  return { lat: 11.94 + dichBacMet / MET_MOI_DO_VI, lng: 108.44, saiSoM, thoiDiem: giay * 1000 }
}

describe('taoBoLocViTri — hằng số', () => {
  it('đúng các ngưỡng đã thống nhất', () => {
    expect(NGUONG_SAI_SO_BO_M).toBe(200)
    expect(CUA_SO_SO_SANH_MS).toBe(30_000)
    expect(VAN_TOC_TOI_DA_KMH).toBe(150)
  })
})

describe('taoBoLocViTri — sai số lớn', () => {
  it('điểm đầu tiên luôn nhận, kể cả sai số lớn (còn hơn không có gì)', () => {
    expect(taoBoLocViTri().nhan(diem(0, 900, 0))).toEqual({ nhan: true })
  })

  it('bỏ điểm sai số > 200 m khi 30 giây gần nhất đã có điểm tốt hơn', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 15, 0))
    expect(loc.nhan(diem(5, 350, 10))).toEqual({ nhan: false, lyDo: 'sai-so-lon' })
  })

  it('nhận điểm sai số > 200 m nếu điểm tốt hơn đã cũ quá 30 giây', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 15, 0))
    expect(loc.nhan(diem(5, 350, 31))).toEqual({ nhan: true })
  })

  it('nhận điểm sai số ≤ 200 m dù trước đó có điểm tốt hơn', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 15, 0))
    expect(loc.nhan(diem(5, 180, 10))).toEqual({ nhan: true })
  })
})

describe('taoBoLocViTri — nhảy bất thường', () => {
  it('bỏ điểm nhảy 2 km trong 10 giây (≈ 720 km/h)', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 10, 0))
    expect(loc.nhan(diem(2000, 10, 10))).toEqual({ nhan: false, lyDo: 'nhay-bat-thuong' })
  })

  it('nhận di chuyển bình thường: 300 m trong 30 giây (36 km/h)', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 10, 0))
    expect(loc.nhan(diem(300, 10, 30))).toEqual({ nhan: true })
  })

  it('không coi là nhảy khi khoảng cách nằm trong sai số 2 điểm (định vị Wi-Fi → GPS chuẩn)', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 1500, 0))
    // 800 m sau 1 giây — tốc độ "thô" 2880 km/h, nhưng điểm trước sai số 1500 m nên đây chỉ là
    // điểm chính xác hơn, không phải di chuyển thật. Bỏ điểm này là kẹt ở vị trí sai.
    expect(loc.nhan(diem(800, 8, 1))).toEqual({ nhan: true })
  })

  it('nhảy liên tiếp đủ số lần tối đa thì chấp nhận (điểm cũ mới là điểm sai)', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 5, 0))
    for (let i = 1; i < SO_LAN_NHAY_LIEN_TIEP_TOI_DA; i++) {
      expect(loc.nhan(diem(5000, 5, i)).nhan).toBe(false)
    }
    expect(loc.nhan(diem(5000, 5, SO_LAN_NHAY_LIEN_TIEP_TOI_DA))).toEqual({ nhan: true })
    // Sau khi chấp nhận, điểm gần vị trí mới là di chuyển bình thường.
    expect(loc.nhan(diem(5010, 5, SO_LAN_NHAY_LIEN_TIEP_TOI_DA + 5))).toEqual({ nhan: true })
  })

  it('xoa() quên lịch sử — điểm kế tiếp như điểm đầu tiên', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 5, 0))
    loc.xoa()
    expect(loc.nhan(diem(9000, 5, 1))).toEqual({ nhan: true })
  })

  it('sai số không rõ (null) thì không tính vào ngưỡng sai số', () => {
    const loc = taoBoLocViTri()
    loc.nhan(diem(0, 5, 0))
    expect(loc.nhan(diem(10, null, 5))).toEqual({ nhan: true })
  })
})
