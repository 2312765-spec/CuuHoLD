import 'fake-indexeddb/auto'
// F-UI-01 — trang hồ sơ: sửa tên + đổi mật khẩu. Kiểm tra phía client chặn trước các lỗi hiển
// nhiên (đỡ 1 vòng mạng trên 3G) nhưng backend vẫn là nơi quyết định cuối.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from '@/types/auth'

vi.mock('@/services/auth.service', () => ({
  capNhatHoSo: vi.fn(),
  doiMatKhau: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn()
}))

import { capNhatHoSo, doiMatKhau } from '@/services/auth.service'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import HoSoView from './HoSoView.vue'

const capNhat = vi.mocked(capNhatHoSo)
const doiMk = vi.mocked(doiMatKhau)

const USER: User = {
  id: 'u1',
  phone: '0901234567',
  name: 'Nguyễn Văn A',
  role: 'rescuer',
  wardCode: '24781',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z'
}

function gan() {
  const auth = useAuthStore()
  auth.setAuth({ accessToken: 'a', refreshToken: 'r', user: { ...USER } })
  return mount(HoSoView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
  capNhat.mockReset()
  doiMk.mockReset()
})

describe('HoSoView — thông tin', () => {
  it('hiện SĐT, vai trò, xã chỉ để xem — không có ô sửa cho chúng', () => {
    const w = gan()
    expect(w.text()).toContain('0901234567')
    expect(w.text()).toContain('Đội cứu hộ')
    expect(w.text()).toContain('24781')
    expect(w.findAll('input').map((i) => i.attributes('name'))).not.toContain('phone')
  })

  it('lưu tên mới (đã trim) và cập nhật luôn user trong phiên', async () => {
    capNhat.mockResolvedValueOnce({ ...USER, name: 'Trần Thị B' })
    const w = gan()
    await w.find('input[name="name"]').setValue('  Trần Thị B  ')
    await w.find('[data-test="form-ten"]').trigger('submit')
    await flushPromises()

    expect(capNhat).toHaveBeenCalledWith('Trần Thị B')
    expect(useAuthStore().user?.name).toBe('Trần Thị B')
    expect(useToastStore().message).toContain('Đã cập nhật')
  })

  it('tên dưới 2 ký tự hoặc không đổi thì không gọi API', async () => {
    const w = gan()
    await w.find('input[name="name"]').setValue('A')
    await w.find('[data-test="form-ten"]').trigger('submit')
    await w.find('input[name="name"]').setValue('Nguyễn Văn A')
    await w.find('[data-test="form-ten"]').trigger('submit')
    await flushPromises()
    expect(capNhat).not.toHaveBeenCalled()
  })
})

describe('HoSoView — đổi mật khẩu', () => {
  async function dien(w: ReturnType<typeof gan>, cu: string, moi: string, nhapLai: string) {
    await w.find('input[name="current-password"]').setValue(cu)
    await w.find('input[name="new-password"]').setValue(moi)
    await w.find('input[name="confirm-password"]').setValue(nhapLai)
    await w.find('[data-test="form-mat-khau"]').trigger('submit')
    await flushPromises()
  }

  it('chặn trước khi gọi API: mới < 8 ký tự, nhập lại không khớp, mới trùng cũ', async () => {
    const w = gan()
    await dien(w, 'cu123456', 'ngan', 'ngan')
    expect(w.text()).toContain('ít nhất 8 ký tự')
    await dien(w, 'cu123456', 'moi456789', 'khac45678')
    expect(w.text()).toContain('không khớp')
    await dien(w, 'cu123456', 'cu123456', 'cu123456')
    expect(w.text()).toContain('phải khác')
    expect(doiMk).not.toHaveBeenCalled()
  })

  it('đổi thành công thì xoá sạch các ô mật khẩu và báo cho người dùng', async () => {
    doiMk.mockResolvedValueOnce(undefined)
    const w = gan()
    await dien(w, 'cu123456', 'moi456789', 'moi456789')

    expect(doiMk).toHaveBeenCalledWith('cu123456', 'moi456789')
    expect((w.find('input[name="current-password"]').element as HTMLInputElement).value).toBe('')
    expect((w.find('input[name="new-password"]').element as HTMLInputElement).value).toBe('')
    expect(useToastStore().message).toContain('Đã đổi mật khẩu')
  })

  it('backend báo lỗi (VD sai mật khẩu hiện tại) thì vẫn đăng nhập, không xoá ô đã gõ', async () => {
    doiMk.mockRejectedValueOnce(new Error('400'))
    const w = gan()
    await dien(w, 'sai12345', 'moi456789', 'moi456789')

    expect(useAuthStore().isLoggedIn).toBe(true)
    expect((w.find('input[name="new-password"]').element as HTMLInputElement).value).toBe('moi456789')
  })
})

describe('HoSoView — thông báo đẩy (F-PWA-05)', () => {
  it('trình duyệt không hỗ trợ (jsdom không có Push API) thì báo rõ, không hiện nút bật', async () => {
    const w = gan()
    await flushPromises()
    const phan = w.find('[data-test="thong-bao"]')
    expect(phan.text()).toContain('không hỗ trợ thông báo đẩy')
    expect(phan.find('[data-test="bat-thong-bao"]').exists()).toBe(false)
  })

  it('mô tả đúng loại thông báo theo vai trò', () => {
    const w = gan()
    expect(w.find('[data-test="thong-bao"]').text()).toContain('đội của bạn được giao nhiệm vụ mới')
  })
})

describe('HoSoView — ghi vết hành trình (SRS F-PWA-04)', () => {
  it('mặc định tắt; bật thì lấy vị trí ngay và chuyển sang "Đang ghi"', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (ok: PositionCallback) =>
          ok({ coords: { latitude: 11.94, longitude: 108.44, accuracy: 10 }, timestamp: Date.now() } as unknown as GeolocationPosition)
      }
    })
    localStorage.clear()
    const w = gan()
    await flushPromises()
    const phan = w.find('[data-test="vet-gps"]')
    expect(phan.text()).toContain('Đang tắt')

    await phan.find('[data-test="bat-tat-vet"]').trigger('click')
    await flushPromises()
    // IndexedDB (giả lập) chạy qua nhiều nhịp bất đồng bộ — chờ tới khi giao diện cập nhật.
    await vi.waitFor(() => {
      expect(w.find('[data-test="vet-gps"]').text()).toContain('Đang ghi')
      expect(w.find('[data-test="vet-gps"]').text()).toContain('1 điểm')
    })
  })
})
