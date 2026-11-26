// Giới hạn bản đồ trong tỉnh: đọc đúng đường viền (đất liền + đảo, đổi [kinh,vĩ] → [vĩ,kinh]),
// khoá kéo ra ngoài tỉnh, không thu nhỏ quá cả tỉnh, có lớp che vùng ngoài tỉnh.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'

// jsdom không có SVGSVGElement.createSVGRect → Leaflet coi như không hỗ trợ SVG. Phải polyfill
// TRƯỚC khi import leaflet (L.Browser.svg tính lúc nạp module) — xem CLAUDE.md 15.19.
vi.hoisted(() => {
  const proto = (globalThis as unknown as { SVGSVGElement?: { prototype: Record<string, unknown> } })
    .SVGSVGElement?.prototype
  if (proto && !proto.createSVGRect) proto.createSVGRect = () => ({})
})
import { flushPromises } from '@vue/test-utils'
import L from 'leaflet'
import { apDungGioiHanTinh, trichVongNgoai } from './gioiHanTinh'

const VIEN = {
  type: 'GeometryCollection',
  geometries: [
    {
      type: 'MultiPolygon',
      coordinates: [
        [[[107.5, 11.0], [108.5, 11.0], [108.5, 12.5], [107.5, 11.0]]],
        [[[108.8, 10.5], [108.95, 10.5], [108.9, 10.6], [108.8, 10.5]]]
      ]
    }
  ]
}

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => VIEN })))
})
afterAll(() => vi.unstubAllGlobals())

let map: L.Map | null = null
afterEach(() => {
  map?.remove()
  map = null
  document.body.innerHTML = ''
})

describe('trichVongNgoai', () => {
  it('lấy vòng ngoài của mọi mảnh, đổi sang [vĩ, kinh]', () => {
    const vong = trichVongNgoai(VIEN)
    expect(vong).toHaveLength(2)
    expect(vong[0][0]).toEqual([11.0, 107.5])
    expect(vong[1][0]).toEqual([10.5, 108.8])
  })

  it('nhận cả FeatureCollection; dữ liệu hỏng → rỗng', () => {
    const fc = { type: 'FeatureCollection', features: [{ geometry: VIEN.geometries[0] }] }
    expect(trichVongNgoai(fc)).toHaveLength(2)
    expect(trichVongNgoai(null)).toEqual([])
  })
})

describe('apDungGioiHanTinh', () => {
  function taoBanDo(): L.Map {
    const el = document.createElement('div')
    document.body.appendChild(el)
    map = L.map(el).setView([11.5, 108], 9)
    return map
  }

  it('đặt maxBounds quanh tỉnh (gồm cả đảo), kéo cứng, và minZoom không cho thu nhỏ ra khỏi tỉnh', async () => {
    const m = taoBanDo()
    apDungGioiHanTinh(m)
    await flushPromises()
    const khung = L.latLngBounds(m.options.maxBounds as L.LatLngBoundsLiteral)
    expect(khung.contains([10.5, 108.8])).toBe(true) // đảo
    expect(khung.contains([12.5, 108.5])).toBe(true)
    expect(khung.contains([10.8, 106.7])).toBe(false) // TP.HCM — ngoài tỉnh
    expect(m.options.maxBoundsViscosity).toBe(1)
    expect(m.getMinZoom()).toBeGreaterThanOrEqual(5)
  })

  it('có pane che vùng ngoài tỉnh, nằm dưới marker', async () => {
    const m = taoBanDo()
    apDungGioiHanTinh(m)
    await flushPromises()
    const pane = m.getPane('vungNgoaiTinh')
    expect(pane).toBeDefined()
    expect(Number(pane!.style.zIndex)).toBeLessThan(400)
  })

  it('bản đồ bị huỷ trước khi tải xong đường viền → không lỗi', async () => {
    const m = taoBanDo()
    apDungGioiHanTinh(m)
    m.remove()
    map = null
    // Không ném lỗi chưa bắt (vitest sẽ báo đỏ nếu có).
    await flushPromises()
    expect(m.getPane('mapPane')).toBeUndefined()
  })
})
