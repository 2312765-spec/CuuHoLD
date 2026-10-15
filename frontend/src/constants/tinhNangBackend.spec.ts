// Tính năng chờ backend (CLAUDE.md Mục 15.22) phải TẮT mặc định — bật nhầm thì người dùng bấm
// vào chỉ nhận lỗi 404 vì API chưa tồn tại.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { coSuaHoSo, coLichSuSos, coThongBaoDay } from './tinhNangBackend'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('tinhNangBackend', () => {
  it('mặc định tắt cả 3 (biến môi trường không đặt hoặc khác "true")', () => {
    vi.stubEnv('VITE_BAT_SUA_HO_SO', '')
    vi.stubEnv('VITE_BAT_LICH_SU_SOS', 'false')
    vi.stubEnv('VITE_BAT_THONG_BAO_DAY', '1')
    expect(coSuaHoSo()).toBe(false)
    expect(coLichSuSos()).toBe(false)
    expect(coThongBaoDay()).toBe(false)
  })

  it('đặt đúng "true" thì bật', () => {
    vi.stubEnv('VITE_BAT_SUA_HO_SO', 'true')
    vi.stubEnv('VITE_BAT_LICH_SU_SOS', 'true')
    vi.stubEnv('VITE_BAT_THONG_BAO_DAY', 'true')
    expect(coSuaHoSo()).toBe(true)
    expect(coLichSuSos()).toBe(true)
    expect(coThongBaoDay()).toBe(true)
  })
})
