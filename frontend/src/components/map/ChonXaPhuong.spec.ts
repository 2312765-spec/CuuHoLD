// Bộ chọn xã/phường trên bản đồ: tìm không dấu, chọn xã → bản đồ bay tới khung của xã + phát mã
// xã ra ngoài (Bảng điều phối lọc SOS theo mã này), "Tất cả" → mã rỗng.
import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import L from 'leaflet'
import ChonXaPhuong from './ChonXaPhuong.vue'

const WARDS = {
  features: [
    {
      properties: { ma_xa: '24778', ten_xa: 'Lâm Viên - Đà Lạt', loai: 'Phường' },
      geometry: { type: 'Polygon', coordinates: [[[108.4, 11.9], [108.5, 12.0], [108.4, 11.9]]] }
    },
    {
      properties: { ma_xa: '24823', ten_xa: '1 Bảo Lộc', loai: 'Phường' },
      geometry: { type: 'Polygon', coordinates: [[[107.8, 11.5], [107.9, 11.6], [107.8, 11.5]]] }
    }
  ]
}

let map: L.Map
let w: VueWrapper | null = null

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => WARDS })))
})
afterAll(() => vi.unstubAllGlobals())
afterEach(() => {
  w?.unmount()
  w = null
  map?.remove()
  document.body.innerHTML = ''
})

async function gan() {
  const el = document.createElement('div')
  document.body.appendChild(el)
  map = L.map(el).setView([11.9, 108.4], 8)
  w = mount(ChonXaPhuong, { props: { map, modelValue: '' }, attachTo: document.body })
  await flushPromises()
}
const nut = () => document.querySelector<HTMLButtonElement>('.chon-xa__nut')!
const cacXa = () => [...document.querySelectorAll<HTMLButtonElement>('.chon-xa__ds button')]

describe('ChonXaPhuong', () => {
  it('nằm trong khung control của Leaflet, mặc định "Tất cả xã/phường"', async () => {
    await gan()
    expect(nut().closest('.leaflet-control')).not.toBeNull()
    expect(nut().textContent).toContain('Tất cả xã/phường')
  })

  it('gõ không dấu lọc được; chọn xã → bay tới khung xã và phát mã xã', async () => {
    await gan()
    const bay = vi.spyOn(map, 'flyToBounds').mockReturnValue(map)
    nut().click()
    await flushPromises()
    const o = document.querySelector<HTMLInputElement>('.chon-xa__tim')!
    o.value = 'lam vien'
    o.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(cacXa().map((b) => b.textContent?.trim())).toEqual(['Phường Lâm Viên - Đà Lạt'])

    cacXa()[0].click()
    await flushPromises()
    expect(w!.emitted('update:modelValue')?.at(-1)).toEqual(['24778'])
    expect(bay).toHaveBeenCalledWith(
      [
        [11.9, 108.4],
        [12.0, 108.5]
      ],
      expect.objectContaining({ maxZoom: 15 })
    )
    expect(document.querySelector('.chon-xa__bang')).toBeNull()
  })

  it('"Tất cả xã/phường" → mã rỗng, không bay', async () => {
    await gan()
    const bay = vi.spyOn(map, 'flyToBounds')
    nut().click()
    await flushPromises()
    cacXa()[0].click()
    expect(w!.emitted('update:modelValue')?.at(-1)).toEqual([''])
    expect(bay).not.toHaveBeenCalled()
  })
})
