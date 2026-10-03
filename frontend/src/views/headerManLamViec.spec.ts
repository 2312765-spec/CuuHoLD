// Header của các màn làm việc (Dashboard, Rescuer) PHẢI chiếm chỗ trong luồng trang. style.css có
// luật toàn cục `header { position: fixed; z-index: 50 }` viết cho header trang chủ; thẻ <header>
// nào không tự khai báo position sẽ ăn luật đó → nội dung trượt lên nằm dưới header, chữ lộ
// qua nền bán trong suốt, hộp nổi trên bản đồ (z-index 800) đè lên header. Test tính cascade
// thật từ file nguồn (helper cssTinhToan) trên DOM đã mount, không grep một dòng.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { docLuat, giaTriTinhToan, type LuatCss } from '@/test-utils/cssTinhToan'

vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(async () => []), xemChiTietSos: vi.fn(), capNhatTienDo: vi.fn(),
  phanCongDoi: vi.fn(), taiAnhSos: vi.fn()
}))
vi.mock('@/services/gisService', () => ({ timDoiGanNhat: vi.fn(async () => []), layHeatmapSos: vi.fn(async () => []) }))
vi.mock('@/services/rescueTeamsService', () => ({ fetchRescueTeams: vi.fn(async () => []), capNhatViTriDoi: vi.fn() }))
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import DashboardView from './DashboardView.vue'
import RescuerView from './RescuerView.vue'

const LUAT_CHUNG = [
  ...docLuat('../assets/style.css', import.meta.url),
  ...docLuat('../assets/map-style.css', import.meta.url)
]

let w: VueWrapper | null = null

async function gan(Comp: object, file: string): Promise<{ w: VueWrapper; luat: LuatCss[] }> {
  w = mount(Comp, {
    attachTo: document.body,
    global: { stubs: { RescueMap: true, AnhHienTruong: true, RouterLink: { template: '<a><slot /></a>' } } }
  })
  await flushPromises()
  return { w, luat: [...LUAT_CHUNG, ...docLuat(file, import.meta.url)] }
}

beforeEach(() => {
  setActivePinia(createPinia())
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() }
  })
})
afterEach(() => {
  w?.unmount()
  w = null
})

describe('header màn làm việc không ăn luật header fixed toàn cục', () => {
  it('Dashboard: .dashboard-top là sticky (top 0), không phải fixed', async () => {
    const { w, luat } = await gan(DashboardView, './DashboardView.vue')
    const header = w.find('header.dashboard-top').element
    expect(giaTriTinhToan(header, 'position', luat)).toBe('sticky')
    expect(giaTriTinhToan(header, 'top', luat)).toBe('0')
  })

  it('Dashboard: vùng bản đồ tự tạo stacking context — pane Leaflet và .map-che-do không vẽ đè header', async () => {
    const { w, luat } = await gan(DashboardView, './DashboardView.vue')
    const banDo = w.find('.dashboard-map').element
    expect(giaTriTinhToan(banDo, 'position', luat)).toBe('relative')
    expect(giaTriTinhToan(banDo, 'z-index', luat)).toBe('0')
  })

  it('Dashboard màn ≤900px: danh sách lấp phần còn lại (header chiếm chỗ nên không cứng 55vh)', async () => {
    const { w, luat } = await gan(DashboardView, './DashboardView.vue')
    const panel = w.find('.dashboard-panel').element
    const tc = { media: ['(max-width: 900px)'] }
    expect(giaTriTinhToan(panel, 'flex', luat, tc)).toBe('1')
    expect(giaTriTinhToan(panel, 'min-height', luat, tc)).toBe('0')
  })

  it('Rescuer: .rescuer-top vẫn sticky (khoá bản vá cũ)', async () => {
    const { w, luat } = await gan(RescuerView, './RescuerView.vue')
    expect(giaTriTinhToan(w.find('header.rescuer-top').element, 'position', luat)).toBe('sticky')
  })
})
