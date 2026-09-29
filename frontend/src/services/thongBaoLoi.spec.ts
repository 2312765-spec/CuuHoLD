// Lỗi từ server trước đây hiện NGUYÊN VĂN kỹ thuật cho người dùng ("Cannot GET /api/...",
// "ThrottlerException: Too Many Requests"). Giờ đổi sang câu tiếng Việt dễ hiểu; thông báo
// nghiệp vụ tiếng Việt do backend viết (VD "Bạn đang có một SOS chưa kết thúc") giữ nguyên.
import { describe, it, expect } from 'vitest'
import { thongBaoLoiThanThien } from './thongBaoLoi'

describe('thongBaoLoiThanThien', () => {
  it('giữ nguyên thông báo tiếng Việt của backend', () => {
    expect(thongBaoLoiThanThien(409, { message: 'Bạn đang có một SOS chưa kết thúc' })).toBe('Bạn đang có một SOS chưa kết thúc')
    expect(thongBaoLoiThanThien(400, { message: ['Số điện thoại không hợp lệ'] })).toBe('Số điện thoại không hợp lệ')
  })

  it('429 luôn là câu dễ hiểu, không lộ "ThrottlerException"', () => {
    const tb = thongBaoLoiThanThien(429, { message: 'ThrottlerException: Too Many Requests' })
    expect(tb).not.toContain('Throttler')
    expect(tb).toContain('thử lại')
  })

  it('404 route chưa có ("Cannot GET ...") → báo chức năng chưa sẵn sàng', () => {
    const tb = thongBaoLoiThanThien(404, { message: 'Cannot GET /api/sos/mine/history?page=1&limit=10' })
    expect(tb).not.toContain('Cannot')
    expect(tb).toContain('chưa')
  })

  it('thông báo tiếng Anh mặc định của framework → câu tiếng Việt theo mã lỗi', () => {
    expect(thongBaoLoiThanThien(403, { message: 'Forbidden resource' })).toBe('Bạn không có quyền thực hiện thao tác này.')
    expect(thongBaoLoiThanThien(401, { message: 'Unauthorized' })).toContain('đăng nhập')
    expect(thongBaoLoiThanThien(400, { message: ['phone must be a string'] })).toBe('Dữ liệu gửi lên chưa hợp lệ, vui lòng kiểm tra lại.')
    expect(thongBaoLoiThanThien(404, { message: 'Not Found' })).toContain('Không tìm thấy')
  })

  it('không có message → câu mặc định theo mã lỗi', () => {
    expect(thongBaoLoiThanThien(400, null)).toBe('Dữ liệu gửi lên chưa hợp lệ, vui lòng kiểm tra lại.')
  })
})
