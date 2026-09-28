// F-PWA-05 — bật/tắt thông báo đẩy. jsdom không có Service Worker/Push API → giả lập tối thiểu.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/services/pushService', () => ({
  layVapidPublicKey: vi.fn(),
  dangKyPush: vi.fn(),
  huyDangKyPush: vi.fn()
}))

import { layVapidPublicKey, dangKyPush, huyDangKyPush } from '@/services/pushService'
import { useThongBaoDay, base64UrlSangUint8Array, huyThongBaoDayTrenMay } from './useThongBaoDay'

interface SubGia {
  endpoint: string
  toJSON: () => unknown
  unsubscribe: ReturnType<typeof vi.fn>
}

let subHienTai: SubGia | null
let pushManager: { getSubscription: ReturnType<typeof vi.fn>; subscribe: ReturnType<typeof vi.fn> }

function taoSub(): SubGia {
  return {
    endpoint: 'https://push/abc',
    toJSON: () => ({ endpoint: 'https://push/abc', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } }),
    unsubscribe: vi.fn(async () => {
      subHienTai = null
      return true
    })
  }
}

function caiMoiTruong(opts: { quyen?: NotificationPermission; ketQuaXin?: NotificationPermission; ua?: string; standalone?: boolean } = {}) {
  subHienTai = null
  pushManager = {
    getSubscription: vi.fn(async () => subHienTai),
    subscribe: vi.fn(async () => {
      subHienTai = taoSub()
      return subHienTai
    })
  }
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  Object.defineProperty(window, 'PushManager', { configurable: true, value: function PushManager() {} })
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { ready: Promise.resolve({ pushManager }) }
  })
  const NotificationGia = {
    permission: opts.quyen ?? 'default',
    requestPermission: vi.fn(async () => {
      NotificationGia.permission = opts.ketQuaXin ?? 'granted'
      return NotificationGia.permission
    })
  }
  Object.defineProperty(window, 'Notification', { configurable: true, value: NotificationGia })
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: opts.ua ?? 'Mozilla/5.0 (Linux; Android 14)' })
  window.matchMedia = vi.fn(() => ({ matches: opts.standalone ?? false })) as unknown as typeof window.matchMedia
  return NotificationGia
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(layVapidPublicKey).mockResolvedValue('AQAB')
  vi.mocked(dangKyPush).mockResolvedValue(undefined)
  vi.mocked(huyDangKyPush).mockResolvedValue(undefined)
})
afterEach(() => {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
})

describe('useThongBaoDay', () => {
  it('trình duyệt không có Push API → khong-ho-tro, không gọi gì', async () => {
    const tb = useThongBaoDay()
    await tb.kiemTra()
    expect(tb.trangThai.value).toBe('khong-ho-tro')
  })

  it('iPhone chưa thêm app ra màn hình chính → can-cai-app (iOS chỉ cho push khi đã cài)', async () => {
    caiMoiTruong({ ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', standalone: false })
    const tb = useThongBaoDay()
    await tb.kiemTra()
    expect(tb.trangThai.value).toBe('can-cai-app')
  })

  it('đã chặn quyền thông báo → bi-chan', async () => {
    caiMoiTruong({ quyen: 'denied' })
    const tb = useThongBaoDay()
    await tb.kiemTra()
    expect(tb.trangThai.value).toBe('bi-chan')
  })

  it('bật: xin quyền → subscribe với khoá VAPID → gửi subscription lên server', async () => {
    const N = caiMoiTruong()
    const tb = useThongBaoDay()
    await tb.kiemTra()
    expect(tb.trangThai.value).toBe('tat')

    await tb.bat()

    expect(N.requestPermission).toHaveBeenCalled()
    const tuyChon = pushManager.subscribe.mock.calls[0][0] as { userVisibleOnly: boolean; applicationServerKey: Uint8Array }
    expect(tuyChon.userVisibleOnly).toBe(true)
    expect(Array.from(tuyChon.applicationServerKey)).toEqual([1, 0, 1])
    expect(dangKyPush).toHaveBeenCalledWith({ endpoint: 'https://push/abc', expirationTime: null, keys: { p256dh: 'p', auth: 'a' } })
    expect(tb.trangThai.value).toBe('bat')
  })

  it('người dùng từ chối quyền khi được hỏi → bi-chan, không subscribe', async () => {
    caiMoiTruong({ ketQuaXin: 'denied' })
    const tb = useThongBaoDay()
    await tb.bat()
    expect(pushManager.subscribe).not.toHaveBeenCalled()
    expect(tb.trangThai.value).toBe('bi-chan')
  })

  it('server lưu lỗi → huỷ subscription vừa tạo trên máy (không để nửa bật nửa tắt)', async () => {
    caiMoiTruong()
    vi.mocked(dangKyPush).mockRejectedValueOnce(new Error('500'))
    const tb = useThongBaoDay()
    await tb.bat()
    expect(subHienTai).toBeNull()
    expect(tb.trangThai.value).toBe('tat')
  })

  it('tắt: báo server rồi huỷ trên máy', async () => {
    caiMoiTruong()
    subHienTai = taoSub()
    const sub = subHienTai
    const tb = useThongBaoDay()
    await tb.kiemTra()
    expect(tb.trangThai.value).toBe('bat')

    await tb.tat()
    expect(huyDangKyPush).toHaveBeenCalledWith('https://push/abc')
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(tb.trangThai.value).toBe('tat')
  })

  it('tắt khi server lỗi/mất mạng → vẫn huỷ trên máy (server tự dọn khi gặp 410)', async () => {
    caiMoiTruong()
    subHienTai = taoSub()
    const sub = subHienTai
    vi.mocked(huyDangKyPush).mockRejectedValueOnce(new Error('mang'))
    const tb = useThongBaoDay()
    await tb.tat()
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(tb.trangThai.value).toBe('tat')
  })
})

describe('huyThongBaoDayTrenMay (gọi lúc đăng xuất)', () => {
  it('huỷ subscription trên máy, KHÔNG gọi API (token có thể đã hết hạn)', async () => {
    caiMoiTruong()
    subHienTai = taoSub()
    const sub = subHienTai
    await huyThongBaoDayTrenMay()
    expect(sub.unsubscribe).toHaveBeenCalled()
    expect(huyDangKyPush).not.toHaveBeenCalled()
  })

  it('không có Service Worker thì im lặng bỏ qua', async () => {
    await expect(huyThongBaoDayTrenMay()).resolves.toBeUndefined()
  })
})

describe('base64UrlSangUint8Array', () => {
  it('giải mã base64url (có - và _, không padding) đúng byte', () => {
    expect(Array.from(base64UrlSangUint8Array('AQAB'))).toEqual([1, 0, 1])
    expect(Array.from(base64UrlSangUint8Array('-_8'))).toEqual([251, 255])
  })
})
