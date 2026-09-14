// Khoảng cách/ETA hiển thị trên RescuerView — phải khớp công thức backend dùng ở
// GisService.findNearestTeams() (ETA = ROUND(km / 40 * 60)), để rescuer và commander
// không thấy 2 con số ETA khác nhau cho cùng một quãng đường.

import { describe, it, expect } from 'vitest'
import { khoangCachMet, etaPhut } from './geo'

describe('khoangCachMet', () => {
  it('trả 0 khi 2 điểm trùng nhau', () => {
    expect(khoangCachMet({ lat: 11.94, lng: 108.44 }, { lat: 11.94, lng: 108.44 })).toBe(0)
  })

  it('1 độ vĩ tuyến ≈ 111.195 km (bán kính Trái Đất 6371 km)', () => {
    expect(khoangCachMet({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111195, -1)
  })

  it('đối xứng — đổi chiều không đổi kết quả', () => {
    const doi = { lat: 11.95, lng: 108.45 }
    const nanNhan = { lat: 11.9465, lng: 108.4419 }
    expect(khoangCachMet(doi, nanNhan)).toBeCloseTo(khoangCachMet(nanNhan, doi), 6)
  })
})

describe('etaPhut', () => {
  it('10 km ở 40 km/h = 15 phút (khớp công thức backend)', () => {
    expect(etaPhut(10000)).toBe(15)
  })

  it('làm tròn giống ROUND() của PostgreSQL', () => {
    expect(etaPhut(1626)).toBe(2) // 2.439 phút
  })

  it('không bao giờ hiện 0 phút', () => {
    expect(etaPhut(0)).toBe(1)
  })
})
