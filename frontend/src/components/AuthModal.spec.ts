// Nút hiện/ẩn mật khẩu tự làm — trước đây chỉ có nút "con mắt" riêng của Edge, tự biến mất khi
// mật khẩu được trình duyệt điền sẵn hoặc ô mất focus, và Chrome/Firefox/Safari không có.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AuthModal from './AuthModal.vue'

beforeEach(() => setActivePinia(createPinia()))

describe('AuthModal — hiện/ẩn mật khẩu', () => {
  it('bấm nút thì chuyển giữa ẩn và hiện, không mất chữ đã gõ', async () => {
    const w = mount(AuthModal, { props: { isOpen: true } })
    const o = () => w.find('input[autocomplete="current-password"], input[autocomplete="new-password"]')
    await o().setValue('matkhau123')
    expect(o().attributes('type')).toBe('password')

    const nut = w.find('[data-test="hien-mat-khau"]')
    expect(nut.attributes('aria-pressed')).toBe('false')
    await nut.trigger('click')
    expect(o().attributes('type')).toBe('text')
    expect(nut.attributes('aria-pressed')).toBe('true')
    expect((o().element as HTMLInputElement).value).toBe('matkhau123')

    await nut.trigger('click')
    expect(o().attributes('type')).toBe('password')
  })
})
