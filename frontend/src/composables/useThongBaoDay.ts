// F-PWA-05 — bật/tắt thông báo đẩy trên THIẾT BỊ NÀY (CLAUDE.md Mục 15.17). Mỗi máy/trình duyệt
// là 1 subscription riêng; bật ở điện thoại không tự bật ở máy tính.
import { ref } from 'vue'
import { layVapidPublicKey, dangKyPush, huyDangKyPush, type PushSubscriptionJson } from '@/services/pushService'

export type TrangThaiThongBao =
  | 'dang-kiem-tra'
  | 'khong-ho-tro' // trình duyệt/HTTP không có Push API
  | 'can-cai-app' // iPhone/iPad: chỉ nhận push khi app đã thêm ra Màn hình chính (iOS ≥ 16.4)
  | 'bi-chan' // người dùng đã chặn quyền thông báo — chỉ mở lại được trong cài đặt trình duyệt
  | 'tat'
  | 'bat'

// Khoá VAPID dạng base64url (có '-' '_', không padding '=') → byte, đúng kiểu
// applicationServerKey mà pushManager.subscribe() cần.
export function base64UrlSangUint8Array(chuoi: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (chuoi.length % 4)) % 4)
  const base64 = (chuoi + padding).replace(/-/g, '+').replace(/_/g, '/')
  const nhiPhan = atob(base64)
  return Uint8Array.from(nhiPhan, (c) => c.charCodeAt(0))
}

function coPushApi(): boolean {
  return (
    window.isSecureContext &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// Cùng cách nhận diện với useInstallPrompt.ts (iPadOS 13+ báo userAgent giống macOS).
function laIosChuaCaiApp(): boolean {
  const ua = navigator.userAgent
  const laIos = /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
  return laIos && !window.matchMedia('(display-mode: standalone)').matches
}

async function laySubscriptionHienTai(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.ready
  return reg.pushManager.getSubscription()
}

// Gọi lúc ĐĂNG XUẤT: chỉ huỷ trên máy, KHÔNG gọi API — lúc này token có thể đã hết hạn (đăng
// xuất do 401). Endpoint bị huỷ → lần sau backend gửi tới sẽ nhận 410 và tự xoá dòng đó
// (đặc tả Mục 6). Không huỷ thì người dùng kế tiếp trên cùng máy vẫn nhận thông báo SOS của
// tài khoản trước — lộ thông tin cứu hộ.
export async function huyThongBaoDayTrenMay(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return
  try {
    const sub = await laySubscriptionHienTai()
    await sub?.unsubscribe()
  } catch {
    // Best-effort — đăng xuất không được phép thất bại vì bước này.
  }
}

export function useThongBaoDay() {
  const trangThai = ref<TrangThaiThongBao>('dang-kiem-tra')
  const dangXuLy = ref(false)
  const loi = ref<string | null>(null)

  async function kiemTra(): Promise<void> {
    if (!coPushApi()) {
      trangThai.value = laIosChuaCaiApp() ? 'can-cai-app' : 'khong-ho-tro'
      return
    }
    if (laIosChuaCaiApp()) {
      trangThai.value = 'can-cai-app'
      return
    }
    if (Notification.permission === 'denied') {
      trangThai.value = 'bi-chan'
      return
    }
    trangThai.value = (await laySubscriptionHienTai()) ? 'bat' : 'tat'
  }

  async function bat(): Promise<void> {
    dangXuLy.value = true
    loi.value = null
    try {
      const quyen = await Notification.requestPermission()
      if (quyen !== 'granted') {
        trangThai.value = quyen === 'denied' ? 'bi-chan' : 'tat'
        return
      }
      const khoa = await layVapidPublicKey()
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: base64UrlSangUint8Array(khoa)
      })
      try {
        await dangKyPush(sub.toJSON() as PushSubscriptionJson)
      } catch (e) {
        // Server không lưu được → huỷ luôn trên máy, tránh trạng thái "máy tưởng đã bật" mà
        // server không biết để gửi.
        await sub.unsubscribe()
        throw e
      }
      trangThai.value = 'bat'
    } catch {
      loi.value = 'Chưa bật được thông báo. Vui lòng thử lại sau.'
      trangThai.value = 'tat'
    } finally {
      dangXuLy.value = false
    }
  }

  async function tat(): Promise<void> {
    dangXuLy.value = true
    loi.value = null
    try {
      const sub = await laySubscriptionHienTai()
      if (sub) {
        try {
          await huyDangKyPush(sub.endpoint)
        } catch {
          // Mất mạng/server lỗi: vẫn huỷ trên máy — server sẽ gặp 410 và tự dọn.
        }
        await sub.unsubscribe()
      }
      trangThai.value = 'tat'
    } finally {
      dangXuLy.value = false
    }
  }

  return { trangThai, dangXuLy, loi, kiemTra, bat, tat }
}
