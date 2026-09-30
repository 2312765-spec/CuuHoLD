// Gom 3 nút hiển thị (giao diện tối, chữ lớn, tương phản cao — F-UI-05/06) vào 1 nút Cài đặt:
// header gọn hơn; bấm mở bảng có chữ rõ ràng, và có nút ✕ / Esc / bấm ra ngoài để đóng.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeToggle from './ThemeToggle.vue'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-contrast')
  document.body.innerHTML = ''
})

function gan() {
  return mount(ThemeToggle, { attachTo: document.body })
}

describe('ThemeToggle — nút Cài đặt hiển thị', () => {
  it('mặc định chỉ có 1 nút ⚙; bấm mới mở bảng 3 công tắc', async () => {
    const w = gan()
    expect(w.findAll('[role="switch"]')).toHaveLength(0)
    const nut = w.find('[data-test="mo-cai-dat"]')
    expect(nut.attributes('aria-expanded')).toBe('false')

    await nut.trigger('click')
    expect(nut.attributes('aria-expanded')).toBe('true')
    const cac = w.findAll('[role="switch"]').map((s) => s.text())
    expect(cac.join('|')).toMatch(/Giao diện tối.*\|.*Chữ lớn.*\|.*Tương phản cao/)
  })

  it('bật "Giao diện tối" thì đổi giao diện và công tắc báo đang bật', async () => {
    const w = gan()
    await w.find('[data-test="mo-cai-dat"]').trigger('click')
    const toi = w.find('[data-test="cai-dat-toi"]')
    expect(toi.attributes('aria-checked')).toBe('false')
    await toi.trigger('click')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(w.find('[data-test="cai-dat-toi"]').attributes('aria-checked')).toBe('true')
  })

  it('đóng được bằng nút ✕, phím Esc và bấm ra ngoài', async () => {
    const w = gan()
    const mo = () => w.find('[data-test="mo-cai-dat"]').trigger('click')
    const dangMo = () => w.find('[data-test="bang-cai-dat"]').exists()

    await mo()
    await w.find('[data-test="dong-cai-dat"]').trigger('click')
    expect(dangMo()).toBe(false)

    await mo()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await w.vm.$nextTick()
    expect(dangMo()).toBe(false)

    await mo()
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await w.vm.$nextTick()
    expect(dangMo()).toBe(false)
  })
})
