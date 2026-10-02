import 'fake-indexeddb/auto'
// Điều hướng "thoát ra" ở các màn làm việc: rescuer/commander từng bị kẹt trong màn của mình
// (chỉ có ✕ không nhãn hoặc ← về chính màn làm việc), muốn ra trang chủ phải đăng xuất hoặc
// gõ địa chỉ. Khoá: mỗi màn có liên kết CÓ NHÃN tới "/" và "/map"; Hồ sơ còn có Đăng xuất và
// nút ← vẫn về đúng màn theo role.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { User } from '@/types/auth'

vi.mock('@/services/auth.service', () => ({
  capNhatHoSo: vi.fn(), doiMatKhau: vi.fn(), login: vi.fn(), getMe: vi.fn()
}))
vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(async () => []), xemChiTietSos: vi.fn(), capNhatTienDo: vi.fn(),
  phanCongDoi: vi.fn(), taiAnhSos: vi.fn()
}))
vi.mock('@/services/gisService', () => ({ timDoiGanNhat: vi.fn(async () => []), layHeatmapSos: vi.fn(async () => []) }))
vi.mock('@/services/rescueTeamsService', () => ({
  fetchRescueTeams: vi.fn(async () => []), capNhatViTriDoi: vi.fn()
}))
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import { useAuthStore } from '@/stores/auth.store'
import HoSoView from './HoSoView.vue'
import RescuerView from './RescuerView.vue'
import DashboardView from './DashboardView.vue'

function user(role: User['role']): User {
  return { id: 'u1', phone: '0900000002', name: 'Tên', role, wardCode: '24781', isActive: true, createdAt: '', updatedAt: '' }
}
// Stub giữ lại `to` thành href để tìm liên kết theo đích.
const RouterLink = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mo(Comp: object, role: User['role']): VueWrapper {
  useAuthStore().setAuth({ accessToken: 'a', refreshToken: 'r', user: user(role) })
  return mount(Comp, { global: { stubs: { RouterLink, RescueMap: true, AnhHienTruong: true } } })
}
function lienKet(w: VueWrapper, to: string, nhan: string) {
  return w.findAll('a').filter((a) => a.attributes('href') === to && a.text() === nhan)
}

beforeEach(() => {
  setActivePinia(createPinia())
  sessionStorage.clear()
})

describe('điều hướng thoát — liên kết có nhãn tới Trang chủ và Bản đồ', () => {
  it('HoSoView: "Trang chủ" → / và "Bản đồ" → /map', () => {
    const w = mo(HoSoView, 'commander')
    expect(lienKet(w, '/', 'Trang chủ')).toHaveLength(1)
    expect(lienKet(w, '/map', 'Bản đồ')).toHaveLength(1)
  })

  it('RescuerView: "Trang chủ" → / và "Xem bản đồ" → /map', async () => {
    const w = mo(RescuerView, 'rescuer')
    await flushPromises()
    expect(lienKet(w, '/', 'Trang chủ')).toHaveLength(1)
    expect(lienKet(w, '/map', 'Xem bản đồ')).toHaveLength(1)
  })

  it('DashboardView: "Trang chủ" → / và "Xem bản đồ" → /map, vẫn còn nút ✕', async () => {
    const w = mo(DashboardView, 'commander')
    await flushPromises()
    expect(lienKet(w, '/', 'Trang chủ')).toHaveLength(1)
    expect(lienKet(w, '/map', 'Xem bản đồ')).toHaveLength(1)
    expect(w.find('.dashboard-close').attributes('aria-label')).toBe('Đóng bảng điều phối')
  })
})

describe('HoSoView — đăng xuất và nút ←', () => {
  it('có nút Đăng xuất, bấm thì gọi authStore.logout', async () => {
    const w = mo(HoSoView, 'rescuer')
    const logout = vi.spyOn(useAuthStore(), 'logout')
    const nut = w.findAll('button').filter((b) => b.text() === 'Đăng xuất')
    expect(nut).toHaveLength(1)
    await nut[0].trigger('click')
    expect(logout).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['rescuer', '/rescuer'],
    ['commander', '/dashboard'],
    ['victim', '/map']
  ] as const)('nút ← của %s về %s', (role, dich) => {
    const w = mo(HoSoView, role)
    expect(w.find('.ho-so-back').attributes('href')).toBe(dich)
    expect(w.find('.ho-so-back').text()).toBe('←')
  })
})
