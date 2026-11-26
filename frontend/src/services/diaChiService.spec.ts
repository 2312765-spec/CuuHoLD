// Tra tên đường qua backend GET /api/geocode/reverse (CLAUDE.md 15.32): KHÔNG gọi thẳng
// Nominatim từ trình duyệt; cùng toạ độ chỉ hỏi 1 lần; lỗi trả null, không toast.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// setup.ts chặn module này cho mọi test khác — ở đây cần bản thật.
vi.unmock('@/services/diaChiService')

const httpGet = vi.fn()
vi.mock('@/services/http', () => ({ http: { get: (...a: unknown[]) => httpGet(...a) } }))

beforeEach(() => {
  vi.resetModules()
  httpGet.mockReset()
})
afterEach(() => vi.unstubAllGlobals())

function ok(tenDuong: string | null) {
  return { data: { success: true, data: { tenDuong } } }
}

describe('layTenDuong', () => {
  it('gọi backend kèm khongHienToastLoi, không gọi fetch thẳng tới Nominatim', async () => {
    const fetchGia = vi.fn()
    vi.stubGlobal('fetch', fetchGia)
    httpGet.mockResolvedValueOnce(ok('Đường Hùng Vương'))
    const { layTenDuong } = await import('./diaChiService')

    expect(await layTenDuong(11.94041, 108.43831)).toBe('Đường Hùng Vương')
    const [url, opts] = httpGet.mock.calls[0]
    expect(url).toBe('/geocode/reverse')
    expect(opts).toMatchObject({ params: { lat: 11.94041, lng: 108.43831 }, khongHienToastLoi: true })
    expect(fetchGia).not.toHaveBeenCalled()
  })

  it('cùng toạ độ (làm tròn ~11 m) chỉ gọi 1 lần, kể cả kết quả null', async () => {
    httpGet.mockResolvedValue(ok(null))
    const { layTenDuong } = await import('./diaChiService')
    const a = layTenDuong(11.94041, 108.43831)
    const b = layTenDuong(11.94042, 108.43832)
    expect(await a).toBeNull()
    expect(await b).toBeNull()
    expect(await layTenDuong(11.94041, 108.43831)).toBeNull()
    expect(httpGet).toHaveBeenCalledTimes(1)
  })

  it('lỗi mạng/503 → null, lần sau gọi lại được', async () => {
    httpGet.mockRejectedValueOnce(new Error('503')).mockResolvedValueOnce(ok('Đường 3 Tháng 2'))
    const { layTenDuong } = await import('./diaChiService')
    expect(await layTenDuong(11.9, 108.4)).toBeNull()
    expect(await layTenDuong(11.9, 108.4)).toBe('Đường 3 Tháng 2')
  })

  it('gửi tuần tự từng yêu cầu (backend xếp hàng 1/giây — không dồn để khỏi quá hạn chờ)', async () => {
    let dangChay = 0
    let toiDa = 0
    httpGet.mockImplementation(async () => {
      dangChay++
      toiDa = Math.max(toiDa, dangChay)
      await Promise.resolve()
      dangChay--
      return ok('X')
    })
    const { layTenDuong } = await import('./diaChiService')
    await Promise.all([0, 1, 2].map((i) => layTenDuong(11.9 + i * 0.01, 108.4)))
    expect(toiDa).toBe(1)
    expect(httpGet).toHaveBeenCalledTimes(3)
  })
})
