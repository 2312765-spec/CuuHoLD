// Router không tải được file JS của trang (lazy chunk) → trước đây bấm link KHÔNG có phản ứng
// gì (router huỷ im lặng), chỉ Ctrl+click / F5 mới vào được. Giờ tự tải lại toàn trang tới
// đúng địa chỉ — nhưng không lặp vô hạn nếu file thật sự hỏng.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { laLoiTaiTrang, xuLyLoiTaiTrang } from './taiLaiKhiLoiTaiTrang'

beforeEach(() => sessionStorage.clear())

describe('laLoiTaiTrang', () => {
  it('nhận đúng thông báo lỗi tải module của Chrome, Firefox, Safari', () => {
    expect(laLoiTaiTrang(new TypeError('Failed to fetch dynamically imported module: http://x/src/views/MapView.vue'))).toBe(true)
    expect(laLoiTaiTrang(new TypeError('error loading dynamically imported module: http://x/a.js'))).toBe(true)
    expect(laLoiTaiTrang(new TypeError('Importing a module script failed.'))).toBe(true)
  })

  it('không nhầm với lỗi khác (lỗi trong code của trang thì tải lại cũng vô ích)', () => {
    expect(laLoiTaiTrang(new Error('Cannot read properties of undefined'))).toBe(false)
    expect(laLoiTaiTrang('chuoi bat ky')).toBe(false)
  })
})

describe('xuLyLoiTaiTrang', () => {
  const loiChunk = new TypeError('Failed to fetch dynamically imported module: /src/views/MapView.vue')

  it('lỗi tải trang → tải lại toàn trang tới đúng địa chỉ đang muốn vào', () => {
    const dieuHuong = vi.fn()
    xuLyLoiTaiTrang(loiChunk, '/map', dieuHuong, () => 1000)
    expect(dieuHuong).toHaveBeenCalledWith('/map')
  })

  it('lỗi khác → không làm gì', () => {
    const dieuHuong = vi.fn()
    xuLyLoiTaiTrang(new Error('khac'), '/map', dieuHuong, () => 1000)
    expect(dieuHuong).not.toHaveBeenCalled()
  })

  it('vừa tải lại cho chính trang đó (< 10s) mà vẫn lỗi → dừng, không tải lại vô hạn', () => {
    const dieuHuong = vi.fn()
    xuLyLoiTaiTrang(loiChunk, '/map', dieuHuong, () => 1000)
    xuLyLoiTaiTrang(loiChunk, '/map', dieuHuong, () => 5000)
    expect(dieuHuong).toHaveBeenCalledTimes(1)
    // Đủ lâu sau đó (VD vừa deploy bản mới lần nữa) thì lại được tự tải lại.
    xuLyLoiTaiTrang(loiChunk, '/map', dieuHuong, () => 20000)
    expect(dieuHuong).toHaveBeenCalledTimes(2)
  })
})
