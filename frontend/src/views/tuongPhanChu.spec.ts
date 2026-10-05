// Tương phản chữ ≥ 4.5:1 (WCAG AA, chữ thường) ở Dashboard/Rescuer cho cả chế độ sáng, tối và
// tương phản cao. Hai màn này CỐ Ý luôn nền sáng (thẻ/panel trắng, nền --fog) kể cả khi bật dark
// mode — nhưng body đổi chữ sang kem sáng ở dark mode, nên phần tử không tự khai báo màu (VD tên
// nạn nhân .sos-victim) kế thừa chữ kem trên nền trắng → gần như vô hình; khu thống kê còn bị
// luật dark ép chữ sáng. Test tính màu thật từ file CSS nguồn (cascade + kế thừa + var(), xem
// test-utils/cssTinhToan.ts) trên DOM đã mount — đổi CSS làm tụt tương phản sẽ đỏ ngay.
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { docLuat, giaTriTinhToan, docMau, mauNen, tiLeTuongPhan, type LuatCss } from '@/test-utils/cssTinhToan'
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

const SAN_AA = 4.5

const LUAT_CHUNG = [
  ...docLuat('../assets/style.css', import.meta.url),
  ...docLuat('../assets/map-style.css', import.meta.url)
]

// KHÔNG có ngoại lệ: số liệu theo trạng thái (.sc-*) cũng phải ≥ 4.5:1 — màu trạng thái chỉ
// dùng cho viền thẻ, chữ số dùng sắc đậm cùng tông (xem DashboardView.vue).

const CHE_DO = [
  { ten: 'sáng', theme: null, contrast: null },
  { ten: 'tối', theme: 'dark', contrast: null },
  { ten: 'tương phản cao', theme: null, contrast: 'high' },
  { ten: 'tối + tương phản cao', theme: 'dark', contrast: 'high' }
] as const

function sos(id: string, status: SosListItem['status']): SosListItem {
  return {
    id, type: 'flood', status, ward_code: '24778', created_at: '2026-10-02T08:00:00Z',
    lat: 11.9, lng: 108.4, location_estimated: false, victim_name: 'Nguyễn Văn A', victim_phone: '0900000001'
  }
}

const CHON = ['.sos-victim', '.stat-num', '.stat-lbl', '.stat-bar-lbl', '.stat-bars-title', '.stat-bar-val']

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
  vi.mocked(layDanhSachSos).mockResolvedValue([sos('a', 'pending'), sos('b', 'assigned')])
  vi.mocked(xemChiTietSos).mockImplementation(async (id: string) => ({ ...sos(id, 'assigned'), assigned_team_id: 't1' }) as SosRequest)
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
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-contrast')
})

function datCheDo(theme: string | null, contrast: string | null): void {
  const html = document.documentElement
  if (theme) html.setAttribute('data-theme', theme)
  else html.removeAttribute('data-theme')
  if (contrast) html.setAttribute('data-contrast', contrast)
  else html.removeAttribute('data-contrast')
}

// Mỗi phần tử khớp selector → tỉ lệ tương phản thật.
function doTuongPhan(w: VueWrapper, luat: LuatCss[], chon: string): { the: string; tiLe: number }[] {
  return w.findAll(chon)
    .map((n) => {
      const chu = docMau(giaTriTinhToan(n.element, 'color', luat) ?? '#000')
      // Ghi kèm class của thẻ cha để biết số nào (VD .sc-in_progress) khi đỏ.
      const cha = n.element.parentElement?.className ?? ''
      return { the: `${chon} "${n.text()}" trong .${cha.replace(/\s+/g, '.')}`, tiLe: Math.round(tiLeTuongPhan(chu, mauNen(n.element, luat)) * 100) / 100 }
    })
}

describe('helper tương phản WCAG', () => {
  it('đen/trắng = 21, cùng màu = 1, rgba được trộn với nền', () => {
    expect(tiLeTuongPhan(docMau('#000'), docMau('#fff'))).toBeCloseTo(21, 1)
    expect(tiLeTuongPhan(docMau('#2a2a24'), docMau('#2a2a24'))).toBeCloseTo(1, 5)
    // Chữ đen 50% trên nền trắng ≡ xám #808080 (~3.95:1).
    expect(tiLeTuongPhan(docMau('rgba(0,0,0,0.5)'), docMau('#ffffff'))).toBeCloseTo(3.95, 1)
  })
})

describe.each(CHE_DO)('tương phản chữ ≥ 4.5:1 — chế độ $ten', ({ theme, contrast }) => {
  it('Dashboard: tên nạn nhân + khu thống kê', () => {
    datCheDo(theme, contrast)
    const kq = CHON.flatMap((c) => doTuongPhan(dash, luatDash, c))
    expect(kq.length).toBeGreaterThan(8) // đã thật sự render: 1 tổng + 2 thẻ số liệu + thanh theo loại + 2 SOS
    // Thẻ trạng thái luôn render (kể cả số 0) → chắc chắn đã đo 2 màu từng là ngoại lệ.
    expect(dash.find('.sc-in_progress .stat-num').exists()).toBe(true)
    expect(dash.find('.sc-resolved .stat-num').exists()).toBe(true)
    expect(kq.filter((k) => k.tiLe < SAN_AA)).toEqual([])
  })

  it('Rescuer: tên nạn nhân trên thẻ nhiệm vụ', () => {
    datCheDo(theme, contrast)
    const kq = doTuongPhan(rescuer, luatRescuer, '.sos-victim')
    expect(kq.length).toBeGreaterThan(0)
    expect(kq.filter((k) => k.tiLe < SAN_AA)).toEqual([])
  })
})
