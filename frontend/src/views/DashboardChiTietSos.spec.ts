// Thẻ SOS trên Bảng điều phối: hiện TÊN xã (không phải mã số "24778"), ngày giờ đầy đủ, số điện
// thoại bấm gọi được, ca nguy kịch lên đầu; "+ Đánh dấu cảnh báo" mở bảng chọn vị trí có hướng dẫn
// (trước đây chỉ đổi con trỏ, không biết bấm vào đâu).
import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { SosListItem } from '@/types'

vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(), phanCongDoi: vi.fn(), xemChiTietSos: vi.fn(async () => ({})), taiAnhSos: vi.fn()
}))
vi.mock('@/services/gisService', () => ({ timDoiGanNhat: vi.fn(async () => []), layHeatmapSos: vi.fn() }))
vi.mock('@/services/rescueTeamsService', () => ({ fetchRescueTeams: vi.fn(async () => []) }))
vi.mock('@/services/hazardsService', () => ({ layTatCaCanhBao: vi.fn(async () => []), taoCanhBao: vi.fn(), giaiQuyetCanhBao: vi.fn() }))
vi.mock('@/services/hazardReportsService', () => ({ layBaoCaoDeKiemDuyet: vi.fn(async () => []) }))
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import { layDanhSachSos } from '@/services/sosService'
import DashboardView from './DashboardView.vue'

const WARDS = {
  features: [
    {
      properties: { ma_xa: '24778', ten_xa: 'Lâm Viên - Đà Lạt', loai: 'Phường' },
      geometry: { type: 'Polygon', coordinates: [[[108.4, 11.9], [108.5, 12.0], [108.4, 11.9]]] }
    }
  ]
}

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => WARDS })))
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => setActivePinia(createPinia()))

function sos(id: string, type: SosListItem['type'], phut: number): SosListItem {
  return {
    id, type, status: 'pending', ward_code: '24778',
    created_at: new Date(2026, 10, 8, 21, phut).toISOString(),
    lat: 11.94, lng: 108.44, location_estimated: true, victim_name: `Người ${id}`, victim_phone: '0901242427'
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

describe('Bảng điều phối — thẻ SOS chi tiết', () => {
  it('tên xã thay mã số, ngày giờ đầy đủ, số điện thoại bấm gọi được', async () => {
    const w = await gan([sos('a', 'medical', 28)])
    const the = w.find('.sos-item')
    expect(the.text()).toContain('Phường Lâm Viên - Đà Lạt')
    expect(the.text()).not.toContain('Xã/phường 24778')
    expect(the.text()).toContain('21:28')
    expect(the.text()).toContain('08/11/2026')
    expect(the.find('a.sos-tel').attributes('href')).toBe('tel:0901242427')
    expect(the.text()).toContain('Vị trí ước tính')
  })

  it('ca nguy kịch lên đầu dù gửi trước, có nhãn mức độ; tab SOS đếm ca gấp', async () => {
    const w = await gan([sos('khac', 'other', 50), sos('chay', 'fire', 10)])
    const the = w.findAll('.sos-item')
    expect(the[0].text()).toContain('Người chay')
    expect(the[0].classes()).toContain('muc-nguy-kich')
    expect(the[0].find('.muc-tag').text()).toBe('Nguy kịch')
    expect(w.find('.tab-gap').text()).toBe('1 ca gấp')
  })
})

describe('Bảng điều phối — đặt cảnh báo', () => {
  it('bấm "+ Đánh dấu cảnh báo" → bảng hướng dẫn kéo ghim, không còn nút "Ghim tại tâm"; Huỷ đóng bảng', async () => {
    const w = await gan([])
    const nutDanhDau = w.findAll('button').find((b) => b.text().includes('Đánh dấu cảnh báo'))
    await nutDanhDau!.trigger('click')

    const bang = w.find('.dat-ghim')
    expect(bang.exists()).toBe(true)
    expect(bang.text()).toContain('Kéo ghim')
    expect(bang.text()).not.toContain('Ghim tại tâm')
    // Bản đồ bị stub (không có Leaflet) nên chưa có ghim → chưa xác nhận được.
    const xacNhan = bang.findAll('button').find((b) => b.text() === 'Xác nhận vị trí')
    expect(xacNhan!.attributes('disabled')).toBeDefined()

    await bang.find('button[aria-label="Huỷ chọn vị trí"]').trigger('click')
    expect(w.find('.dat-ghim').exists()).toBe(false)
  })
})
