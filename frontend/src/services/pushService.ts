// F-PWA-05 — Web Push. Route theo đặc tả gửi B (F-PWA-05-dac-ta-API-cho-B.md).
import { http } from './http'

export interface PushSubscriptionJson {
  endpoint: string
  expirationTime: number | null
  keys: { p256dh: string; auth: string }
}

export async function layVapidPublicKey(): Promise<string> {
  const { data } = await http.get('/push/vapid-public-key')
  return (data.data as { publicKey: string }).publicKey
}

// Gửi NGUYÊN PushSubscription.toJSON() — backend upsert theo endpoint và gán lại user_id =
// người đang đăng nhập (1 máy đổi tài khoản thì người sau không nhận thông báo của người trước).
export async function dangKyPush(sub: PushSubscriptionJson): Promise<void> {
  await http.post('/push/subscriptions', sub)
}

export async function huyDangKyPush(endpoint: string): Promise<void> {
  await http.delete('/push/subscriptions', { data: { endpoint } })
}
