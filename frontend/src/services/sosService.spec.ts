// F-SOS-06 (CLAUDE.md Mục 15.14) — khoá cấu hình request ảnh:
// http.ts đặt mặc định Content-Type: application/json; axios 1.x gặp FormData + header JSON
// sẽ tự đổi FormData thành JSON → file biến mất mà KHÔNG báo lỗi. Nên phải ghi rõ multipart.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./http', () => ({ http: { post: vi.fn(), get: vi.fn() } }))

import { http } from './http'
import { dinhKemAnhSos, taiAnhSos, layLichSuSosCuaToi } from './sosService'

const post = vi.mocked(http.post)
const get = vi.mocked(http.get)

beforeEach(() => {
  post.mockReset()
  get.mockReset()
})

describe('sosService — ảnh hiện trường', () => {
  it('dinhKemAnhSos gửi multipart field "image" tới /sos/:id/image, timeout dài', async () => {
    post.mockResolvedValueOnce({ data: { data: { imageUrl: '/api/sos/abc/image' } } })
    const anh = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' })

    const kq = await dinhKemAnhSos('abc', anh)

    expect(kq).toEqual({ imageUrl: '/api/sos/abc/image' })
    const [url, body, cauHinh] = post.mock.calls[0]
    expect(url).toBe('/sos/abc/image')
    expect(body).toBeInstanceOf(FormData)
    expect((body as FormData).get('image')).toBeInstanceOf(Blob)
    expect(cauHinh?.headers).toEqual({ 'Content-Type': 'multipart/form-data' })
    expect(cauHinh?.timeout).toBeGreaterThanOrEqual(30000)
  })

  it('taiAnhSos lấy ảnh dạng blob (để gửi được Bearer token, không dùng <img src>)', async () => {
    const blob = new Blob(['x'], { type: 'image/jpeg' })
    get.mockResolvedValueOnce({ data: blob })

    expect(await taiAnhSos('abc')).toBe(blob)
    expect(get.mock.calls[0][0]).toBe('/sos/abc/image')
    expect(get.mock.calls[0][1]?.responseType).toBe('blob')
  })
})

describe('sosService — lịch sử SOS (F-UI-02)', () => {
  it('gọi GET /sos/mine/history với page/limit và trả nguyên trang dữ liệu', async () => {
    const trang = { items: [], total: 0, page: 2, limit: 10 }
    get.mockResolvedValueOnce({ data: { data: trang } })

    expect(await layLichSuSosCuaToi(2, 10)).toEqual(trang)
    expect(get.mock.calls[0][0]).toBe('/sos/mine/history')
    expect(get.mock.calls[0][1]?.params).toEqual({ page: 2, limit: 10 })
  })
})
