// F-PWA-02: token cho service worker gửi SOS nền (IndexedDB 'phien-dong-bo') phải bị xoá khi
// người dùng đăng xuất — không để token nằm lại trong máy sau khi họ đã chủ động đăng xuất.
import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from './auth.store'
import { luuPhienDongBo, layPhienDongBo } from '@/utils/offlineQueue'

describe('auth.store logout', () => {
  it('xoá phiên gửi SOS nền của đúng người vừa đăng xuất, giữ của người khác', async () => {
    setActivePinia(createPinia())
    const auth = useAuthStore()
    auth.setAuth({
      accessToken: 'tok-u1',
      refreshToken: 'r',
      user: { id: 'u1', phone: '09', name: 'A', role: 'victim', wardCode: '1', isActive: true, createdAt: '', updatedAt: '' }
    })
    const phien = { accessToken: 't', apiBaseUrl: 'https://x/api', luuLuc: new Date().toISOString() }
    await luuPhienDongBo({ victimId: 'u1', ...phien })
    await luuPhienDongBo({ victimId: 'u2', ...phien })

    auth.logout()

    await vi.waitFor(async () => expect(await layPhienDongBo('u1')).toBeUndefined())
    expect(await layPhienDongBo('u2')).toBeDefined()
  })
})
