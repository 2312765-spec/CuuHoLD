// Kích thước vùng bản đồ + hộp chọn chế độ trên bản đồ (đọc cascade thật từ CSS nguồn, helper
// test-utils/cssTinhToan.ts):
// - Dashboard .map-che-do ("Điểm SOS | Mật độ"): chữ 15px, nút/ô chọn cao ≥ 44px (vùng chạm),
//   nằm góc trên PHẢI — nút zoom của RescueMap ở góc trên TRÁI (mặc định Leaflet) nên không che.
// - Rescuer .rescuer-map: trước 42vh/min 260px quá thấp để vừa xem đường chim bay vừa xem
//   vùng quanh nạn nhân → clamp(360px, 60vh, 720px), màn ≤ 480px 55vh.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { docLuat, giaTriTinhToan, type LuatCss } from '@/test-utils/cssTinhToan'
import type { SosListItem, SosRequest } from '@/types'

vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(), xemChiTietSos: vi.fn(), capNhatTienDo: vi.fn(), phanCongDoi: vi.fn(), taiAnhSos: vi.fn()
}))
vi.mock('@/services/gisService', () => ({ timDoiGanNhat: vi.fn(async () => []), layHeatmapSos: vi.fn(async () => []) }))
vi.mock('@/services/rescueTeamsService', () => ({
  fetchRescueTeams: vi.fn(async () => [{ id: 't1', name: 'Đội 1', status: 'busy', leader_id: 'u1' }]),
  capNhatViTriDoi: vi.fn()
}))
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import { layDanhSachSos, xemChiTietSos } from '@/services/sosService'
import { useAuthStore } from '@/stores/auth.store'
import DashboardView from './DashboardView.vue'
import RescuerView from './RescuerView.vue'

const LUAT_CHUNG = [
  ...docLuat('../assets/style.css', import.meta.url),
  ...docLuat('../assets/map-style.css', import.meta.url)
]

function sos(id: string): SosListItem {
  return {
    id, type: 'flood', status: 'assigned', ward_code: '24778', created_at: '2026-10-02T08:00:00Z',
    lat: 11.9, lng: 108.4, location_estimated: false, victim_name: 'A', victim_phone: '0900000001'
  }
}

// Biến, không viết literal: Vite viết lại new URL('literal', import.meta.url) thành URL http://.
const FILE_RESCUE_MAP = '../components/map/RescueMap.vue'

let dash: VueWrapper
let rescuer: VueWrapper
let luatDash: LuatCss[]
let luatRescuer: LuatCss[]

beforeAll(async () => {
  setActivePinia(createPinia())
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true, value: { watchPosition: vi.fn(() => 1), clearWatch: vi.fn() }
  })
  useAuthStore().setAuth({
    accessToken: 'a', refreshToken: 'r',
    user: { id: 'u1', phone: '0900000002', name: 'Tên', role: 'rescuer', wardCode: '24778', isActive: true, createdAt: '', updatedAt: '' }
  })
  vi.mocked(layDanhSachSos).mockResolvedValue([sos('a')])
  vi.mocked(xemChiTietSos).mockImplementation(async (id: string) => ({ ...sos(id), assigned_team_id: 't1' }) as SosRequest)
  const stubs = { RescueMap: true, AnhHienTruong: true, RouterLink: { template: '<a><slot /></a>' } }
  dash = mount(DashboardView, { attachTo: document.body, global: { stubs } })
  rescuer = mount(RescuerView, { attachTo: document.body, global: { stubs } })
  await flushPromises()
  luatDash = [...LUAT_CHUNG, ...docLuat('./DashboardView.vue', import.meta.url)]
  luatRescuer = [...LUAT_CHUNG, ...docLuat('./RescuerView.vue', import.meta.url)]
})

afterAll(() => {
  dash.unmount()
  rescuer.unmount()
})

describe('Dashboard — hộp chọn chế độ bản đồ (.map-che-do)', () => {
  it('chữ 15px', () => {
    expect(giaTriTinhToan(dash.find('.map-che-do').element, 'font-size', luatDash)).toBe('15px')
  })

  it('nút "Điểm SOS"/"Mật độ" và ô chọn khoảng thời gian cao ≥ 44px', async () => {
    const nut = dash.findAll('.map-che-do__nhom button')
    expect(nut).toHaveLength(2)
    for (const n of nut) expect(parseFloat(giaTriTinhToan(n.element, 'min-height', luatDash) ?? '0')).toBeGreaterThanOrEqual(44)
    await nut[1].trigger('click') // chế độ Mật độ mới có ô chọn
    const chon = dash.find('.map-che-do select')
    expect(parseFloat(giaTriTinhToan(chon.element, 'min-height', luatDash) ?? '0')).toBeGreaterThanOrEqual(44)
    await nut[0].trigger('click')
  })

  it('nằm góc trên phải; nút zoom RescueMap không bị dời sang phải', () => {
    const hop = dash.find('.map-che-do').element
    expect(giaTriTinhToan(hop, 'right', luatDash)).not.toBeNull()
    expect(giaTriTinhToan(hop, 'left', luatDash)).toBeNull()
    const rescueMap = readFileSync(fileURLToPath(new URL(FILE_RESCUE_MAP, import.meta.url).href), 'utf8')
    expect(rescueMap).not.toMatch(/topright/)
  })
})

describe('Rescuer — chiều cao bản đồ (.rescuer-map)', () => {
  it('clamp(360px, 60vh, 720px), không còn min-height cũ', () => {
    const el = rescuer.find('.rescuer-map').element
    expect(giaTriTinhToan(el, 'height', luatRescuer)).toBe('clamp(360px, 60vh, 720px)')
    expect(giaTriTinhToan(el, 'min-height', luatRescuer)).toBeNull()
  })

  it('màn ≤ 480px: 55vh', () => {
    const el = rescuer.find('.rescuer-map').element
    expect(giaTriTinhToan(el, 'height', luatRescuer, { media: ['(max-width: 480px)'] })).toBe('55vh')
  })

  it('giữ position: relative; z-index: 0 (bản đồ không vẽ đè header)', () => {
    const el = rescuer.find('.rescuer-map').element
    expect(giaTriTinhToan(el, 'position', luatRescuer)).toBe('relative')
    expect(giaTriTinhToan(el, 'z-index', luatRescuer)).toBe('0')
  })
})
