// F-PWA-05 — khoá hợp đồng với backend (F-PWA-05-dac-ta-API-cho-B.md).
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./http', () => ({ http: { get: vi.fn(), post: vi.fn(), delete: vi.fn() } }))

import { http } from './http'
import { layVapidPublicKey, dangKyPush, huyDangKyPush } from './pushService'

beforeEach(() => vi.clearAllMocks())

describe('pushService', () => {
  it('lấy public key từ GET /push/vapid-public-key', async () => {
    vi.mocked(http.get).mockResolvedValueOnce({ data: { data: { publicKey: 'BPkey' } } })
    expect(await layVapidPublicKey()).toBe('BPkey')
    expect(vi.mocked(http.get).mock.calls[0][0]).toBe('/push/vapid-public-key')
  })

  it('đăng ký gửi nguyên PushSubscription.toJSON() lên POST /push/subscriptions', async () => {
    vi.mocked(http.post).mockResolvedValueOnce({ data: { data: null } })
    const sub = { endpoint: 'https://push/abc', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }
    await dangKyPush(sub)
    expect(http.post).toHaveBeenCalledWith('/push/subscriptions', sub)
  })

  it('huỷ đăng ký gửi endpoint trong body của DELETE /push/subscriptions', async () => {
    vi.mocked(http.delete).mockResolvedValueOnce({ data: { data: null } })
    await huyDangKyPush('https://push/abc')
    expect(http.delete).toHaveBeenCalledWith('/push/subscriptions', { data: { endpoint: 'https://push/abc' } })
  })
})
