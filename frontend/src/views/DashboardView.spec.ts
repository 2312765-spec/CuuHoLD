// Modal khi commander bấm 1 SOS: chỉ SOS đang CHỜ mới "Phân công đội". SOS đã có đội / đã kết
// thúc trước đây vẫn mở modal phân công + gọi tìm đội gần nhất — backend chỉ trả đội đang RẢNH,
// đội được giao đang bận nên luôn ra "Không có đội nào sẵn sàng" dù thẻ ghi "Đã phân công".
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { SosListItem, SosRequest } from '@/types'

vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(),
  phanCongDoi: vi.fn(),
  xemChiTietSos: vi.fn(),
  taiAnhSos: vi.fn()
}))
vi.mock('@/services/gisService', () => ({ timDoiGanNhat: vi.fn(), layHeatmapSos: vi.fn() }))
vi.mock('@/services/rescueTeamsService', () => ({ fetchRescueTeams: vi.fn(async () => []) }))
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import { layDanhSachSos, xemChiTietSos } from '@/services/sosService'
import { timDoiGanNhat } from '@/services/gisService'
import DashboardView from './DashboardView.vue'

function sos(id: string, status: SosListItem['status']): SosListItem {
  return {
    id, type: 'landslide', status, ward_code: '24778', created_at: '2026-09-29T08:01:00Z',
    lat: 11.9, lng: 108.4, location_estimated: false, victim_name: 'cứu tôi', victim_phone: '0912345679'
  }
}

async function gan(ds: SosListItem[]) {
  vi.mocked(layDanhSachSos).mockResolvedValue(ds)
  const w = mount(DashboardView, {
    global: { stubs: { RescueMap: true, RouterLink: { template: '<a><slot /></a>' } } }
  })
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
})

describe('DashboardView — modal khi bấm SOS', () => {
  it('SOS đang chờ → modal phân công, tìm đội gần nhất', async () => {
    vi.mocked(timDoiGanNhat).mockResolvedValue([])
    vi.mocked(xemChiTietSos).mockResolvedValue({ id: 'a' } as SosRequest)
    const w = await gan([sos('a', 'pending')])

    await w.find('.sos-item').trigger('click')
    await flushPromises()

    expect(w.find('.modal-card h3').text()).toBe('Phân công đội cứu hộ')
    expect(timDoiGanNhat).toHaveBeenCalled()
    expect(w.find('.modal-card').text()).toContain('đội đang làm nhiệm vụ không được tính')
  })

  it('SOS đã phân công → modal chi tiết, hiện đội phụ trách, KHÔNG tìm đội', async () => {
    vi.mocked(xemChiTietSos).mockResolvedValue({ id: 'b', team_name: 'Đội Xuân Hương 2' } as SosRequest)
    const w = await gan([sos('b', 'assigned')])

    await w.find('.sos-item').trigger('click')
    await flushPromises()

    const modal = w.find('.modal-card')
    expect(modal.find('h3').text()).toBe('Chi tiết yêu cầu SOS')
    expect(modal.text()).toContain('Đã phân công')
    expect(modal.text()).toContain('Đội Xuân Hương 2')
    expect(modal.text()).not.toContain('Không có đội nào')
    expect(timDoiGanNhat).not.toHaveBeenCalled()
  })

  it('SOS đã huỷ → modal chi tiết, không có đội, không tìm đội', async () => {
    vi.mocked(xemChiTietSos).mockResolvedValue({ id: 'c', team_name: null } as SosRequest)
    const w = await gan([sos('c', 'cancelled')])

    await w.find('.sos-item').trigger('click')
    await flushPromises()

    expect(w.find('.modal-card h3').text()).toBe('Chi tiết yêu cầu SOS')
    expect(w.find('.modal-card').text()).toContain('Đã huỷ')
    expect(timDoiGanNhat).not.toHaveBeenCalled()
  })
})
