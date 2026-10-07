// Hồi quy: merge 01a9704 đã xoá mất marker.addTo(sosLayer)/addTo(teamLayer)/on('click') khi
// giải quyết conflict — marker vẫn được TẠO nhưng không bao giờ lên bản đồ, nên dashboard
// commander và RescuerView trống trơn dù danh sách SOS bên cạnh vẫn đủ. Test đếm thẳng phần
// tử vẽ ra trong DOM để bắt đúng lớp lỗi này, không phụ thuộc cách code gắn layer.

import { describe, it, expect, afterEach, vi } from 'vitest'

// jsdom thiếu SVGSVGElement.createSVGRect → Leaflet (kiểm tra LÚC IMPORT, Browser.svg) coi như
// không hỗ trợ SVG, circleMarker không có renderer. Phải chạy TRƯỚC khi import leaflet nên
// dùng vi.hoisted (import tĩnh bị kéo lên đầu file).
vi.hoisted(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: Record<string, unknown> } }).SVGSVGElement?.prototype
  if (proto && !proto.createSVGRect) proto.createSVGRect = () => ({})
})
import { mount, type VueWrapper } from '@vue/test-utils'
import RescueMap from './RescueMap.vue'
import type { RescueTeam } from '@/types'

const SOS = { id: 'sos-1', type: 'flood' as const, status: 'pending' as const, lat: 11.76, lng: 108.49, victim_name: 'Nạn nhân A' }
const TEAM: RescueTeam = {
  id: 'team-1',
  name: 'Đội 1',
  status: 'available',
  specialties: [],
  ward_code: '24781',
  lat: 11.94,
  lng: 108.44,
  leader_id: 'u-1',
  leader_name: 'Leader',
  leader_phone: '0900000002'
}

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

function markers(): NodeListOf<Element> {
  return wrapper!.element.querySelectorAll('.leaflet-overlay-pane path.leaflet-interactive')
}

describe('RescueMap — marker SOS và đội cứu hộ', () => {
  it('vẽ đủ marker cho mỗi SOS và mỗi đội có toạ độ', () => {
    wrapper = mount(RescueMap, { props: { sosList: [SOS], teams: [TEAM] }, attachTo: document.body })
    expect(markers()).toHaveLength(2)
  })

  it('bấm marker SOS phát select-sos kèm id', () => {
    wrapper = mount(RescueMap, { props: { sosList: [SOS], teams: [] }, attachTo: document.body })
    const path = markers()[0]
    expect(path).toBeDefined()
    path.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(wrapper.emitted('select-sos')).toEqual([['sos-1']])
  })

  it('SOS mới đến sau (socket sos:new) cũng được vẽ', async () => {
    wrapper = mount(RescueMap, { props: { sosList: [], teams: [] }, attachTo: document.body })
    expect(markers()).toHaveLength(0)
    await wrapper.setProps({ sosList: [SOS] })
    expect(markers()).toHaveLength(1)
  })
})
