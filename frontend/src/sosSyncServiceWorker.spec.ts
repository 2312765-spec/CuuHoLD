// SRS F-PWA-02 — public/sos-sync-sw.js (Background Sync). Chạy ĐÚNG mã nguồn file đó với
// `self`/`fetch` giả lập, trên IndexedDB giả lập do CHÍNH utils/offlineQueue.ts tạo — nhờ vậy
// lệch tên DB/store/trường giữa trang và service worker sẽ làm test này đỏ.
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  themSosVaoHangDoi,
  layToanBoHangDoiSos,
  xoaKhoiHangDoiSos,
  luuPhienDongBo,
  layPhienDongBo,
  xoaPhienDongBo
} from '@/utils/offlineQueue'
import type { QueuedSos } from '@/types/offline'

const MA_NGUON = readFileSync(resolve(__dirname, '../public/sos-sync-sw.js'), 'utf8')

type XuLy = (e: unknown) => void

function chayServiceWorker(fetchGia: ReturnType<typeof vi.fn>) {
  const xuLy: Record<string, XuLy> = {}
  const cuaSo = { postMessage: vi.fn() }
  const self = {
    addEventListener: (ten: string, fn: XuLy) => {
      xuLy[ten] = fn
    },
    registration: { showNotification: vi.fn(async () => undefined) },
    clients: { matchAll: vi.fn(async () => [cuaSo]) },
    navigator: {}
  }
  new Function('self', 'fetch', 'indexedDB', MA_NGUON)(self, fetchGia, indexedDB)
  async function kichHoatSync(tag = 'gui-sos-hang-doi') {
    let hua: Promise<unknown> = Promise.resolve()
    xuLy.sync({ tag, waitUntil: (p: Promise<unknown>) => (hua = p) })
    return hua
  }
  return { kichHoatSync, self, cuaSo }
}

function sos(localId: string, victimId = 'v1'): QueuedSos {
  return {
    localId,
    victimId,
    lat: 11.94,
    lng: 108.44,
    type: 'landslide',
    description: 'kẹt dưới đất',
    locationEstimated: false,
    taoLuc: new Date().toISOString()
  }
}

const phien = (victimId = 'v1', luuLuc = new Date().toISOString()) => ({
  victimId,
  accessToken: `token-${victimId}`,
  apiBaseUrl: 'https://api.vidu.vn/api/',
  luuLuc
})

const phanHoi = (status: number, data: unknown = { id: 'sos-that' }) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => ({ data })
})

beforeEach(async () => {
  for (const m of await layToanBoHangDoiSos()) await xoaKhoiHangDoiSos(m.localId)
  for (const id of ['v1', 'v2']) await xoaPhienDongBo(id)
})

describe('sos-sync-sw.js — Background Sync gửi SOS', () => {
  it('gửi SOS có phiên hợp lệ: đúng URL + Bearer, body không lộ victimId/localId; xoá mục + token; báo người dùng', async () => {
    await themSosVaoHangDoi(sos('a'))
    await luuPhienDongBo(phien())
    const f = vi.fn(async () => phanHoi(201))
    const sw = chayServiceWorker(f)

    await sw.kichHoatSync()

    const [url, init] = f.mock.calls[0] as unknown as [string, { headers: Record<string, string>; body: string }]
    expect(url).toBe('https://api.vidu.vn/api/sos')
    expect(init.headers.Authorization).toBe('Bearer token-v1')
    expect(JSON.parse(init.body)).toEqual({
      lat: 11.94,
      lng: 108.44,
      type: 'landslide',
      locationEstimated: false,
      description: 'kẹt dưới đất'
    })
    expect(await layToanBoHangDoiSos()).toEqual([])
    expect(await layPhienDongBo('v1')).toBeUndefined()
    expect(sw.self.registration.showNotification).toHaveBeenCalledWith('Đã gửi yêu cầu SOS', expect.anything())
    expect(sw.cuaSo.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sos-da-gui', ketQua: { id: 'sos-that' } })
    )
  })

  it('không có phiên của đúng chủ nhân → KHÔNG gửi bằng token người khác', async () => {
    await themSosVaoHangDoi(sos('a', 'v1'))
    await luuPhienDongBo(phien('v2'))
    const f = vi.fn()
    await chayServiceWorker(f).kichHoatSync()
    expect(f).not.toHaveBeenCalled()
    expect(await layToanBoHangDoiSos()).toHaveLength(1)
  })

  it('token quá 24 giờ → không gửi, giữ nguyên cho trang xử lý khi đăng nhập lại', async () => {
    await themSosVaoHangDoi(sos('a'))
    await luuPhienDongBo(phien('v1', new Date(Date.now() - 25 * 3600 * 1000).toISOString()))
    const f = vi.fn()
    await chayServiceWorker(f).kichHoatSync()
    expect(f).not.toHaveBeenCalled()
  })

  it('vẫn mất mạng → giữ mục và báo trình duyệt thử lại sau', async () => {
    await themSosVaoHangDoi(sos('a'))
    await luuPhienDongBo(phien())
    const f = vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(chayServiceWorker(f).kichHoatSync()).rejects.toThrow()
    expect(await layToanBoHangDoiSos()).toHaveLength(1)
    expect(await layPhienDongBo('v1')).toBeDefined()
  })

  it('lỗi nghiệp vụ 4xx (VD 409 đã có SOS) → giữ mục, KHÔNG thử lại vô ích', async () => {
    await themSosVaoHangDoi(sos('a'))
    await luuPhienDongBo(phien())
    const f = vi.fn(async () => phanHoi(409))
    await expect(chayServiceWorker(f).kichHoatSync()).resolves.toBeUndefined()
    expect(await layToanBoHangDoiSos()).toHaveLength(1)
  })

  it('server 5xx → giữ mục, thử lại sau', async () => {
    await themSosVaoHangDoi(sos('a'))
    await luuPhienDongBo(phien())
    const f = vi.fn(async () => phanHoi(503))
    await expect(chayServiceWorker(f).kichHoatSync()).rejects.toThrow()
    expect(await layToanBoHangDoiSos()).toHaveLength(1)
  })

  it('tag sync khác → không làm gì', async () => {
    await themSosVaoHangDoi(sos('a'))
    await luuPhienDongBo(phien())
    const f = vi.fn()
    await chayServiceWorker(f).kichHoatSync('khac')
    expect(f).not.toHaveBeenCalled()
  })
})
