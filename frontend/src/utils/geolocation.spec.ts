// Bug thật (2026-09-13): SOS gửi kèm toạ độ lệch ~100-200m so với vị trí thật. Root cause
// (xem báo cáo cùng ngày): getCurrentPosition() trước đây KHÔNG bật enableHighAccuracy, nên
// trình duyệt được phép trả vị trí định vị theo Wi-Fi/trạm phát sóng (sai số 100-300m) thay
// vì GPS thật; và pos.coords.accuracy chưa từng được đọc, nên MỌI kết quả "thành công" bị
// coi là chính xác tuyệt đối, kể cả khi sai số rất lớn. Các test dưới khoá lại 2 hành vi đó.

import { describe, it, expect, vi } from 'vitest'
import { layViTriHienTai, TOA_DO_UOC_TINH_TAM_TINH } from './geolocation'

function taoGeolocationGia(
  ketQua: { latitude: number; longitude: number; accuracy: number } | 'loi'
): Pick<Geolocation, 'getCurrentPosition'> & { getCurrentPosition: ReturnType<typeof vi.fn> } {
  return {
    getCurrentPosition: vi.fn((success: PositionCallback, error?: PositionErrorCallback) => {
      if (ketQua === 'loi') {
        error?.({ code: 1, message: 'denied' } as GeolocationPositionError)
        return
      }
      success({
        coords: {
          latitude: ketQua.latitude,
          longitude: ketQua.longitude,
          accuracy: ketQua.accuracy,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null
        },
        timestamp: Date.now()
      } as GeolocationPosition)
    })
  }
}

describe('layViTriHienTai', () => {
  it('không có navigator.geolocation → toạ độ tâm tỉnh, uocLuong true', async () => {
    const ketQua = await layViTriHienTai(undefined)
    expect(ketQua).toEqual(TOA_DO_UOC_TINH_TAM_TINH)
  })

  it('getCurrentPosition báo lỗi (từ chối quyền/timeout) → toạ độ tâm tỉnh, uocLuong true', async () => {
    const geo = taoGeolocationGia('loi')
    const ketQua = await layViTriHienTai(geo)
    expect(ketQua).toEqual(TOA_DO_UOC_TINH_TAM_TINH)
  })

  it('thành công với sai số thấp (20m) → dùng đúng toạ độ, uocLuong false', async () => {
    const geo = taoGeolocationGia({ latitude: 11.9, longitude: 108.4, accuracy: 20 })
    const ketQua = await layViTriHienTai(geo)
    expect(ketQua).toEqual({ lat: 11.9, lng: 108.4, uocLuong: false })
  })

  it('thành công nhưng sai số cao (250m) → vẫn dùng đúng toạ độ, nhưng gắn uocLuong true dù trình duyệt báo "thành công" — đây chính là bug đã gặp', async () => {
    const geo = taoGeolocationGia({ latitude: 11.9, longitude: 108.4, accuracy: 250 })
    const ketQua = await layViTriHienTai(geo)
    expect(ketQua).toEqual({ lat: 11.9, lng: 108.4, uocLuong: true })
  })

  it('luôn gọi getCurrentPosition với enableHighAccuracy:true — trước đây thiếu, khiến trình duyệt được phép dùng định vị Wi-Fi/cell thô thay vì GPS', async () => {
    const geo = taoGeolocationGia({ latitude: 11.9, longitude: 108.4, accuracy: 20 })
    await layViTriHienTai(geo)
    expect(geo.getCurrentPosition).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.objectContaining({ enableHighAccuracy: true })
    )
  })
})
