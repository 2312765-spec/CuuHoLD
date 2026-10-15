// F-SOS-06 — rescuer/commander xem ảnh hiện trường: chỉ tải khi bấm, lỗi thì cho thử lại.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('@/services/sosService', () => ({ taiAnhSos: vi.fn() }))

import { taiAnhSos } from '@/services/sosService'
import AnhHienTruong from './AnhHienTruong.vue'

const taiAnh = vi.mocked(taiAnhSos)

beforeEach(() => {
  taiAnh.mockReset()
  URL.createObjectURL = vi.fn(() => 'blob:anh-1')
  URL.revokeObjectURL = vi.fn()
})

describe('AnhHienTruong', () => {
  it('không tự tải ảnh khi chưa bấm (tiết kiệm dữ liệu di động của đội cứu hộ)', () => {
    mount(AnhHienTruong, { props: { sosId: 'sos-1' } })
    expect(taiAnh).not.toHaveBeenCalled()
  })

  it('bấm nút thì tải đúng ảnh của SOS và hiện ra', async () => {
    taiAnh.mockResolvedValueOnce(new Blob(['x'], { type: 'image/jpeg' }))
    const w = mount(AnhHienTruong, { props: { sosId: 'sos-1' } })

    await w.find('button').trigger('click')
    await flushPromises()

    expect(taiAnh).toHaveBeenCalledWith('sos-1')
    expect(w.find('img').attributes('src')).toBe('blob:anh-1')
  })

  it('tải lỗi thì báo và cho bấm thử lại', async () => {
    taiAnh.mockRejectedValueOnce(new Error('404'))
    const w = mount(AnhHienTruong, { props: { sosId: 'sos-1' } })

    await w.find('button').trigger('click')
    await flushPromises()

    expect(w.find('img').exists()).toBe(false)
    expect(w.find('button').text()).toContain('thử lại')
  })

  it('gỡ component thì giải phóng object URL (tránh rò bộ nhớ trên máy yếu)', async () => {
    taiAnh.mockResolvedValueOnce(new Blob(['x'], { type: 'image/jpeg' }))
    const w = mount(AnhHienTruong, { props: { sosId: 'sos-1' } })
    await w.find('button').trigger('click')
    await flushPromises()

    w.unmount()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:anh-1')
  })
})
