import { describe, it, expect } from 'vitest'
import { kiemTraHoTroCamera, phanLoaiLoiCamera, THONG_BAO_LOI_CAMERA } from './camera'

const loi = (name: string) => Object.assign(new Error('x'), { name })

describe('phanLoaiLoiCamera', () => {
  it('người dùng từ chối quyền camera (kể cả tên lỗi cũ của trình duyệt đời cũ)', () => {
    expect(phanLoaiLoiCamera(loi('NotAllowedError'))).toBe('bi_tu_choi')
    expect(phanLoaiLoiCamera(loi('PermissionDeniedError'))).toBe('bi_tu_choi')
    expect(phanLoaiLoiCamera(loi('SecurityError'))).toBe('bi_tu_choi')
  })

  it('thiết bị không có camera', () => {
    expect(phanLoaiLoiCamera(loi('NotFoundError'))).toBe('khong_co_camera')
    expect(phanLoaiLoiCamera(loi('OverconstrainedError'))).toBe('khong_co_camera')
  })

  it('camera đang bị ứng dụng khác chiếm', () => {
    expect(phanLoaiLoiCamera(loi('NotReadableError'))).toBe('dang_duoc_dung')
    expect(phanLoaiLoiCamera(loi('AbortError'))).toBe('dang_duoc_dung')
  })

  it('lỗi lạ hoặc không phải Error → "khac", không ném', () => {
    expect(phanLoaiLoiCamera(loi('Gi_Do_La'))).toBe('khac')
    expect(phanLoaiLoiCamera('chuoi')).toBe('khac')
    expect(phanLoaiLoiCamera(null)).toBe('khac')
    expect(phanLoaiLoiCamera(undefined)).toBe('khac')
  })

  it('mọi loại lỗi đều có thông báo tiếng Việt cho người dùng', () => {
    for (const k of Object.keys(THONG_BAO_LOI_CAMERA)) {
      expect(THONG_BAO_LOI_CAMERA[k as keyof typeof THONG_BAO_LOI_CAMERA].length).toBeGreaterThan(10)
    }
  })
})

describe('kiemTraHoTroCamera', () => {
  const coCamera = { mediaDevices: { getUserMedia: () => Promise.resolve() } }

  it('có getUserMedia → có thể thử (null)', () => {
    expect(kiemTraHoTroCamera(coCamera, true)).toBeNull()
  })

  it('không có mediaDevices trên http:// (ngữ cảnh KHÔNG bảo mật) → hướng dẫn dùng https', () => {
    expect(kiemTraHoTroCamera({}, false)).toBe('khong_an_toan')
  })

  it('không có mediaDevices dù đã là ngữ cảnh bảo mật → trình duyệt không hỗ trợ', () => {
    expect(kiemTraHoTroCamera({}, true)).toBe('khong_ho_tro')
    expect(kiemTraHoTroCamera({ mediaDevices: {} }, true)).toBe('khong_ho_tro')
  })
})
