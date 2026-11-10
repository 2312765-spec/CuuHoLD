// Tra tên đường (Nominatim): cùng toạ độ chỉ hỏi 1 lần, lỗi mạng trả null (không toast, không
// ném), và ưu tiên tên đường hơn tên thôn.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// setup.ts chặn module này cho mọi test khác — ở đây cần bản thật.
vi.unmock('@/services/diaChiService')

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function phanHoi(address: Record<string, string>) {
  return { ok: true, json: async () => ({ address }) }
}

describe('tenDuongTuDiaChi', () => {
  it('có số nhà + đường → ghép; không có đường → "Gần <thôn>"; không có gì → null', async () => {
    const { tenDuongTuDiaChi } = await import('./diaChiService')
    expect(tenDuongTuDiaChi({ road: 'Đường Trần Hưng Đạo', house_number: '12' })).toBe('12 Đường Trần Hưng Đạo')
    expect(tenDuongTuDiaChi({ hamlet: 'Thôn 3' })).toBe('Gần Thôn 3')
    expect(tenDuongTuDiaChi({})).toBeNull()
    expect(tenDuongTuDiaChi(undefined)).toBeNull()
  })
})

describe('layTenDuong', () => {
  it('cùng toạ độ (làm tròn ~11 m) chỉ gọi Nominatim 1 lần', async () => {
    const fetchGia = vi.fn(async () => phanHoi({ road: 'Đường Hùng Vương' }))
    vi.stubGlobal('fetch', fetchGia)
    const { layTenDuong } = await import('./diaChiService')

    const a = layTenDuong(11.94041, 108.43831)
    const b = layTenDuong(11.94042, 108.43832)
    await vi.runAllTimersAsync()
    expect(await a).toBe('Đường Hùng Vương')
    expect(await b).toBe('Đường Hùng Vương')
    expect(fetchGia).toHaveBeenCalledTimes(1)
    expect(String(fetchGia.mock.calls[0])).toContain('accept-language=vi')
  })

  it('lỗi mạng → null, lần sau gọi lại được', async () => {
    const fetchGia = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(phanHoi({ road: 'Đường 3 Tháng 2' }))
    vi.stubGlobal('fetch', fetchGia)
    const { layTenDuong } = await import('./diaChiService')

    const lan1 = layTenDuong(11.9, 108.4)
    await vi.runAllTimersAsync()
    expect(await lan1).toBeNull()
    const lan2 = layTenDuong(11.9, 108.4)
    await vi.runAllTimersAsync()
    expect(await lan2).toBe('Đường 3 Tháng 2')
  })
})
