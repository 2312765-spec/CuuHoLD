// Nút hiện/ẩn mật khẩu tự làm — trước đây chỉ có nút "con mắt" riêng của Edge, tự biến mất khi
// mật khẩu được trình duyệt điền sẵn hoặc ô mất focus, và Chrome/Firefox/Safari không có.
import { describe, it, expect, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, type AxiosAdapter } from 'axios'
import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
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

// Tài khoản bị khoá (isActive=false) → backend trả 403 "Tài khoản đã bị khóa" (auth.service.ts).
// Đi qua http.ts THẬT (adapter giả thay mạng) để kiểm đúng câu người dùng nhìn thấy: câu tiếng
// Việt của server được giữ nguyên, KHÔNG bị thay bằng câu chung "Bạn không có quyền...".
describe('AuthModal — đăng nhập tài khoản bị khoá', () => {
  function adapterLoi(status: number, message: string): AxiosAdapter {
    return async (config) => {
      const response = { data: { statusCode: status, message }, status, statusText: '', headers: {}, config }
      throw new AxiosError('loi', 'ERR_BAD_REQUEST', config, null, response)
    }
  }

  async function dangNhapVoi(status: number, message: string) {
    http.defaults.adapter = adapterLoi(status, message)
    const w = mount(AuthModal, { props: { isOpen: true } })
    await w.find('input[type="tel"]').setValue('0900000009')
    await w.find('input[autocomplete="current-password"]').setValue('demo1234')
    await w.find('.auth-submit').trigger('click')
    await flushPromises()
    return w
  }

  it('403 → hiện đúng "Tài khoản đã bị khóa", không đăng nhập, không đóng modal', async () => {
    const w = await dangNhapVoi(403, 'Tài khoản đã bị khóa')

    expect(useToastStore().message).toBe('Tài khoản đã bị khóa')
    expect(useAuthStore().isLoggedIn).toBe(false)
    expect(w.emitted('loggedIn')).toBeUndefined()
    expect(w.emitted('close')).toBeUndefined()
    // Nút đăng nhập mở lại được để thử tài khoản khác.
    expect(w.find('.auth-submit').attributes('disabled')).toBeUndefined()
  })

  it('sai mật khẩu (401) vẫn là câu riêng, không lẫn với tài khoản bị khoá', async () => {
    await dangNhapVoi(401, 'Sai thông tin đăng nhập')
    expect(useToastStore().message).toBe('Sai thông tin đăng nhập')
  })
})
