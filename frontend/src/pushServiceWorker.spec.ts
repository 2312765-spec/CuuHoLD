// F-PWA-05 — public/push-sw.js (nạp vào service worker qua workbox.importScripts). File JS thuần
// chạy trong service worker, nên test bằng cách chạy nó với `self`/`clients` giả lập.
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const MA_NGUON = readFileSync(resolve(__dirname, '../public/push-sw.js'), 'utf8')

type XuLy = (e: unknown) => void

function chay() {
  const xuLy: Record<string, XuLy> = {}
  const showNotification = vi.fn(async () => undefined)
  const cuaSo = { focus: vi.fn(async () => undefined), navigate: vi.fn(async () => undefined) }
  const clients = {
    matchAll: vi.fn(async () => [] as (typeof cuaSo)[]),
    openWindow: vi.fn(async () => undefined)
  }
  const self = {
    addEventListener: (ten: string, fn: XuLy) => {
      xuLy[ten] = fn
    },
    registration: { showNotification }
  }
  new Function('self', 'clients', MA_NGUON)(self, clients)
  return { xuLy, showNotification, clients, cuaSo }
}

async function suKienPush(xuLy: XuLy, duLieu: unknown) {
  let hua: Promise<unknown> = Promise.resolve()
  xuLy({
    data: duLieu === undefined ? null : { json: () => duLieu, text: () => String(duLieu) },
    waitUntil: (p: Promise<unknown>) => {
      hua = p
    }
  })
  await hua
}

describe('push-sw.js', () => {
  it('hiện thông báo từ payload, gắn tag để thông báo mới thay cái cũ cùng SOS', async () => {
    const { xuLy, showNotification } = chay()
    await suKienPush(xuLy.push, { title: 'Đã phân công đội', body: 'Đội đang tới', url: '/map', tag: 'sos-1' })
    expect(showNotification).toHaveBeenCalledWith(
      'Đã phân công đội',
      expect.objectContaining({ body: 'Đội đang tới', tag: 'sos-1', renotify: true, data: { url: '/map' } })
    )
  })

  it('payload hỏng/rỗng vẫn hiện thông báo mặc định (không nuốt mất tin khẩn)', async () => {
    const { xuLy, showNotification } = chay()
    await suKienPush(xuLy.push, undefined)
    expect(showNotification).toHaveBeenCalledWith('Cứu Trợ Lâm Đồng', expect.objectContaining({ data: { url: '/' } }))
  })

  it('chỉ nhận url tương đối — URL ngoài (có thể là trang lừa đảo) bị thay bằng /', async () => {
    const { xuLy, showNotification } = chay()
    for (const url of ['https://gia-mao.vn', '//gia-mao.vn', 'javascript:alert(1)']) {
      await suKienPush(xuLy.push, { title: 'x', url })
    }
    for (const call of showNotification.mock.calls as unknown as [string, { data: { url: string } }][]) {
      expect(call[1].data.url).toBe('/')
    }
  })

  it('bấm thông báo: có cửa sổ app đang mở thì focus + chuyển trang, không có thì mở mới', async () => {
    const a = chay()
    a.clients.matchAll.mockResolvedValueOnce([a.cuaSo])
    let hua: Promise<unknown> = Promise.resolve()
    const close = vi.fn()
    a.xuLy.notificationclick({ notification: { close, data: { url: '/lich-su' } }, waitUntil: (p: Promise<unknown>) => (hua = p) })
    await hua
    expect(close).toHaveBeenCalled()
    expect(a.cuaSo.focus).toHaveBeenCalled()
    expect(a.cuaSo.navigate).toHaveBeenCalledWith('/lich-su')

    const b = chay()
    b.xuLy.notificationclick({ notification: { close: vi.fn(), data: { url: '/rescuer' } }, waitUntil: (p: Promise<unknown>) => (hua = p) })
    await hua
    expect(b.clients.openWindow).toHaveBeenCalledWith('/rescuer')
  })
})
