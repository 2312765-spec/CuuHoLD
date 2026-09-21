// TDD cho CLAUDE.md kế hoạch "#2 — payload/UI thiếu ETA đội cứu hộ" (SRS Phụ lục A +
// F-RT-01 3.4.1, áp dụng cho victim). SosTrackerPanel.vue đã có teamLat/teamLng qua props
// (lấy từ poll 20s — Mục 15.11 Fix #2), nhưng CHƯA tính/hiện khoảng cách + ETA. Test này
// mô tả hành vi MONG MUỐN sau khi sửa — phải ĐỎ cho tới khi component tự tính bằng
// khoangCachMet()/etaPhut() (frontend/src/utils/geo.ts, đã có sẵn, dùng chung công thức
// với RescuerView + backend GisService) và hiện ra template.

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SosTrackerPanel from './SosTrackerPanel.vue'
import { khoangCachMet, etaPhut, dinhDangKhoangCach } from '@/utils/geo'
import type { ActiveSos } from '@/composables/useSos'

function buildActiveSos(overrides: Partial<ActiveSos> = {}): ActiveSos {
  return {
    id: 'sos-1',
    type: 'flood',
    status: 'assigned',
    lat: 11.9465,
    lng: 108.4419,
    locationEstimated: false,
    createdAt: '2026-09-17T10:00:00Z',
    cancelDeadline: '2026-09-17T10:03:00Z',
    assignedTeamId: 'team-1',
    teamDangDiChuyen: true,
    ...overrides
  }
}

describe('SosTrackerPanel — khoảng cách/ETA đội cứu hộ', () => {
  it('có teamLat/teamLng → hiện khoảng cách + ETA tính đúng bằng khoangCachMet/etaPhut', () => {
    const activeSos = buildActiveSos({ teamLat: 11.95, teamLng: 108.45 })
    const metMongDoi = khoangCachMet(
      { lat: activeSos.teamLat!, lng: activeSos.teamLng! },
      { lat: activeSos.lat, lng: activeSos.lng }
    )
    const phutMongDoi = etaPhut(metMongDoi)

    const wrapper = mount(SosTrackerPanel, {
      props: { activeSos, dangHoatDong: true, dangHuy: false }
    })

    const text = wrapper.text()
    expect(text).toContain(`ETA ~${phutMongDoi} phút`)
    expect(text).toContain(`~${dinhDangKhoangCach(metMongDoi)}`)
  })

  it('khoảng cách < 1km → hiện đơn vị mét', () => {
    // ~111m theo hướng bắc (0.001 độ vĩ ≈ 111m)
    const activeSos = buildActiveSos({ teamLat: 11.9475, teamLng: 108.4419 })
    const wrapper = mount(SosTrackerPanel, {
      props: { activeSos, dangHoatDong: true, dangHuy: false }
    })
    expect(wrapper.text()).toContain('Cách bạn ~111 m')
  })

  it('khoảng cách >= 1km → hiện đơn vị km với 1 chữ số thập phân', () => {
    // ~2.0km về phía đông bắc
    const activeSos = buildActiveSos({ teamLat: 11.96, teamLng: 108.45 })
    const wrapper = mount(SosTrackerPanel, {
      props: { activeSos, dangHoatDong: true, dangHuy: false }
    })
    expect(wrapper.text()).toMatch(/Cách bạn ~\d+\.\d km/)
  })

  it('chưa có teamLat/teamLng (đội chưa gửi GPS lần nào) → không hiện khoảng cách/ETA, giữ nguyên dòng "Đã có đội cứu hộ được phân công"', () => {
    const activeSos = buildActiveSos({
      teamLat: null,
      teamLng: null,
      teamDangDiChuyen: false
    })
    const wrapper = mount(SosTrackerPanel, {
      props: { activeSos, dangHoatDong: true, dangHuy: false }
    })
    const text = wrapper.text()
    expect(text).not.toMatch(/ETA/)
    expect(text).toContain('Đã có đội cứu hộ được phân công')
  })

  it('chưa được phân công đội (assignedTeamId rỗng) → không hiện khoảng cách/ETA', () => {
    const activeSos = buildActiveSos({
      assignedTeamId: undefined,
      teamLat: null,
      teamLng: null
    })
    const wrapper = mount(SosTrackerPanel, {
      props: { activeSos, dangHoatDong: true, dangHuy: false }
    })
    expect(wrapper.text()).not.toMatch(/ETA/)
  })
})
