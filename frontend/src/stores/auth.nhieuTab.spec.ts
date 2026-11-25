// Mở tab mới trong cùng trình duyệt từng bị "đăng xuất" vì sessionStorage mỗi tab một bản
// (CLAUDE.md Mục 15.30). Hai Pinia riêng = hai tab; BroadcastChannel của Node nối chúng lại.
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth.store'
import { xinPhienTuTabKhac } from '@/utils/phienGiuaTab'

vi.mock('@/composables/useThongBaoDay', () => ({ huyThongBaoDayTrenMay: vi.fn(async () => undefined) }))

const USER = { id: 'u1', phone: '09', name: 'A', role: 'victim' as const, wardCode: '1', isActive: true, createdAt: '', updatedAt: '' }

function moTab() {
  const pinia = createPinia()
  setActivePinia(pinia)
  return useAuthStore(pinia)
}

describe('auth.store — nhiều tab', () => {
  // jsdom dùng chung 1 sessionStorage cho mọi "tab" trong test — xoá để tab mới không tự khôi phục.
  beforeEach(() => sessionStorage.clear())

  it('tab mới xin được phiên của tab đang đăng nhập', async () => {
    const tabA = moTab()
    tabA.setAuth({ accessToken: 'tok', refreshToken: 'r', user: USER })
    const phien = await xinPhienTuTabKhac(500)
    expect(phien?.accessToken).toBe('tok')
    expect(phien?.user.id).toBe('u1')
    tabA.logout()
  })

  it('đăng nhập ở tab A → tab B (đang mở, chưa đăng nhập) cũng đăng nhập', async () => {
    const tabB = moTab()
    const tabA = moTab()
    tabA.setAuth({ accessToken: 'tok2', refreshToken: 'r', user: USER })
    await vi.waitFor(() => expect(tabB.isLoggedIn).toBe(true))
    expect(tabB.accessToken).toBe('tok2')
    tabA.logout()
  })

  it('đăng xuất ở tab A → tab B cũng đăng xuất', async () => {
    const tabA = moTab()
    const tabB = moTab()
    tabA.setAuth({ accessToken: 'tok3', refreshToken: 'r', user: USER })
    await vi.waitFor(() => expect(tabB.isLoggedIn).toBe(true))
    tabA.logout()
    await vi.waitFor(() => expect(tabB.isLoggedIn).toBe(false))
  })

  it('nhanPhien() gán phiên mà KHÔNG phát lại cho tab khác', () => {
    const tab = moTab()
    tab.nhanPhien({ accessToken: 'tok4', refreshToken: 'r', user: USER })
    expect(tab.isLoggedIn).toBe(true)
    expect(tab.accessToken).toBe('tok4')
  })
})
