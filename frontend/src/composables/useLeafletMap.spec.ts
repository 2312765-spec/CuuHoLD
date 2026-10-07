// Sau khi victim gửi SOS, bản đồ phải tự zoom vào marker SOS của chính họ để dễ theo dõi
// (đội được giao tới gần sẽ hiện ngay cạnh) — không bắt người đang hoảng loạn tự tìm pin.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import L from 'leaflet'
import { useLeafletMap, ZOOM_THEO_DOI_SOS } from './useLeafletMap'

let container: HTMLDivElement
let map: L.Map

beforeEach(() => {
  setActivePinia(createPinia())
  container = document.createElement('div')
  document.body.appendChild(container)
  map = L.map(container).setView([11.94, 108.44], 8)
})

afterEach(() => {
  map.remove()
  container.remove()
})

describe('useLeafletMap — phongToToiSosCuaMinh', () => {
  it('zoom tới vị trí SOS ở mức theo dõi', () => {
    const lm = useLeafletMap()
    lm.mapInstance.value = map
    lm.phongToToiSosCuaMinh(11.7611, 108.4957)
    expect(map.getZoom()).toBe(ZOOM_THEO_DOI_SOS)
    expect(map.getCenter().lat).toBeCloseTo(11.7611, 4)
    expect(map.getCenter().lng).toBeCloseTo(108.4957, 4)
  })

  it('KHÔNG zoom ra nếu người dùng đang xem sâu hơn mức theo dõi', () => {
    map.setZoom(ZOOM_THEO_DOI_SOS + 2)
    const lm = useLeafletMap()
    lm.mapInstance.value = map
    lm.phongToToiSosCuaMinh(11.7611, 108.4957)
    expect(map.getZoom()).toBe(ZOOM_THEO_DOI_SOS + 2)
    expect(map.getCenter().lat).toBeCloseTo(11.7611, 4)
  })

  it('chưa có bản đồ thì bỏ qua, không ném lỗi', () => {
    const lm = useLeafletMap()
    expect(() => lm.phongToToiSosCuaMinh(11.7611, 108.4957)).not.toThrow()
  })
})
