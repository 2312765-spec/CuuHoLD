// Menu hamburger (màn hẹp): mở thì biểu tượng đổi thành ✕ để đóng, và chọn 1 mục thì menu tự
// đóng (trước đây menu cứ mở che nội dung sau khi đã nhảy tới mục).
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AppHeader from './AppHeader.vue'

beforeEach(() => setActivePinia(createPinia()))

function gan() {
  return mount(AppHeader, {
    global: { stubs: { RouterLink: { template: '<a><slot /></a>' }, NotificationBell: true, ThemeToggle: true } }
  })
}

describe('AppHeader — menu hamburger', () => {
  it('mở/đóng bằng cùng 1 nút, nhãn + aria-expanded đổi theo', async () => {
    const w = gan()
    const nut = w.find('.menu-btn')
    expect(nut.attributes('aria-expanded')).toBe('false')
    expect(nut.attributes('aria-label')).toBe('Mở menu')

    await nut.trigger('click')
    expect(w.find('.nav-links').classes()).toContain('open')
    expect(nut.attributes('aria-expanded')).toBe('true')
    expect(nut.attributes('aria-label')).toBe('Đóng menu')

    await nut.trigger('click')
    expect(w.find('.nav-links').classes()).not.toContain('open')
  })

  it('bấm 1 mục trong menu thì menu tự đóng', async () => {
    const w = gan()
    await w.find('.menu-btn').trigger('click')
    await w.find('.nav-links a[href="#quy-trinh"]').trigger('click')
    expect(w.find('.nav-links').classes()).not.toContain('open')
  })
})
