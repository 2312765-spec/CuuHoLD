// F-UI-02 — trang lịch sử SOS cá nhân của victim.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import type { SosLichSuItem, SosRequest } from '@/types'

vi.mock('@/services/sosService', () => ({
  layLichSuSosCuaToi: vi.fn(),
  xemChiTietSos: vi.fn(),
  taiAnhSos: vi.fn()
}))

import { layLichSuSosCuaToi, xemChiTietSos } from '@/services/sosService'
import LichSuSosView from './LichSuSosView.vue'

const layLichSu = vi.mocked(layLichSuSosCuaToi)
const xemChiTiet = vi.mocked(xemChiTietSos)

function item(id: string, o: Partial<SosLichSuItem> = {}): SosLichSuItem {
  return {
    id,
    type: 'flood',
    status: 'resolved',
    description: null,
    image_url: null,
    location_estimated: false,
    created_at: '2026-09-20T08:00:00Z',
    resolved_at: null,
    lat: 11.94,
    lng: 108.44,
    team_name: null,
    ...o
  }
}

function gan() {
  return mount(LichSuSosView, { global: { stubs: { RouterLink: { template: '<a><slot /></a>' } } } })
}

beforeEach(() => {
  setActivePinia(createPinia())
  layLichSu.mockReset()
  xemChiTiet.mockReset()
})

describe('LichSuSosView', () => {
  it('hiện mỗi SOS một thẻ với loại, trạng thái tiếng Việt và đội phụ trách', async () => {
    layLichSu.mockResolvedValueOnce({
      items: [
        item('a', { status: 'resolved', team_name: 'Đội Xuân Hương 2' }),
        item('b', { type: 'medical', status: 'cancelled', location_estimated: true })
      ],
      total: 2,
      page: 1,
      limit: 10
    })
    const w = gan()
    await flushPromises()

    const the = w.findAll('[data-test="the-sos"]')
    expect(the).toHaveLength(2)
    expect(the[0].text()).toContain('Lũ lụt')
    expect(the[0].text()).toContain('Hoàn tất')
    expect(the[0].text()).toContain('Đội Xuân Hương 2')
    expect(the[1].text()).toContain('Y tế khẩn cấp')
    expect(the[1].text()).toContain('Đã huỷ')
    expect(the[1].text()).toContain('Vị trí ước tính')
  })

  it('chưa gửi SOS nào thì báo rõ, không để trang trống', async () => {
    layLichSu.mockResolvedValueOnce({ items: [], total: 0, page: 1, limit: 10 })
    const w = gan()
    await flushPromises()
    expect(w.text()).toContain('Bạn chưa gửi yêu cầu SOS nào')
  })

  it('còn dữ liệu thì có nút tải thêm, bấm tải trang kế tiếp và nối vào danh sách', async () => {
    layLichSu
      .mockResolvedValueOnce({ items: [item('a')], total: 2, page: 1, limit: 10 })
      .mockResolvedValueOnce({ items: [item('b')], total: 2, page: 2, limit: 10 })
    const w = gan()
    await flushPromises()

    await w.find('[data-test="tai-them"]').trigger('click')
    await flushPromises()

    expect(layLichSu).toHaveBeenLastCalledWith(2, 10)
    expect(w.findAll('[data-test="the-sos"]')).toHaveLength(2)
    expect(w.find('[data-test="tai-them"]').exists()).toBe(false)
  })

  it('bấm xem chi tiết thì tải timeline của đúng SOS đó', async () => {
    layLichSu.mockResolvedValueOnce({ items: [item('a')], total: 1, page: 1, limit: 10 })
    xemChiTiet.mockResolvedValueOnce({
      id: 'a',
      timeline: [{ id: 't1', actor_id: 'u', action: 'created', note: null, created_at: '2026-09-20T08:00:00Z' }]
    } as SosRequest)
    const w = gan()
    await flushPromises()

    await w.find('[data-test="xem-chi-tiet"]').trigger('click')
    await flushPromises()

    expect(xemChiTiet).toHaveBeenCalledWith('a')
    expect(w.text()).toContain('Đã tạo yêu cầu')
  })

  it('tải lỗi thì cho thử lại', async () => {
    layLichSu.mockRejectedValueOnce(new Error('mat mang'))
    const w = gan()
    await flushPromises()
    expect(w.find('[data-test="thu-lai"]').exists()).toBe(true)
  })
})
