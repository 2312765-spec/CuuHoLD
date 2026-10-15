// Mở ra thì phải có nút tắt: bảng thông báo trước đây chỉ đóng được bằng cách bấm ra ngoài —
// trên điện thoại người dùng không biết cách tắt.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/stores/auth.store'
import NotificationBell from './NotificationBell.vue'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
  useAuthStore().setAuth({
    accessToken: 'a',
    refreshToken: 'r',
    user: { id: 'u1', phone: '09', name: 'A', role: 'commander', wardCode: '1', isActive: true, createdAt: '', updatedAt: '' }
  })
})

describe('NotificationBell', () => {
  it('bảng thông báo có nút ✕ để đóng', async () => {
    const w = mount(NotificationBell)
    await w.find('.noti-btn').trigger('click')
    expect(w.find('.noti-panel').exists()).toBe(true)

    const nut = w.find('[data-test="dong-thong-bao"]')
    expect(nut.attributes('aria-label')).toBe('Đóng bảng thông báo')
    await nut.trigger('click')
    expect(w.find('.noti-panel').exists()).toBe(false)
  })
})
