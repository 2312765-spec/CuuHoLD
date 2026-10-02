// Khoá 3 hành vi của RescueMap.vue:
// 1. Marker SOS THỰC SỰ được vẽ + bấm được — từng mất sạch sau merge 01a9704 (dòng
//    marker.addTo()/on('click') biến mất khi giải quyết conflict), bản đồ Dashboard/Rescuer
//    trống trơn mà build/lint/test vẫn xanh vì chưa có test nào cho component này.
// 2. F-MAP-05 gom cụm: màu cụm theo SOS GẤP NHẤT bên trong + badge đếm SOS 'pending'.
// 3. F-MAP-03 chế độ bản đồ nhiệt: ẩn marker SOS, quay lại thì hiện lại.
// Chạy thật qua import 'leaflet.markercluster'/'leaflet.heat' (plugin đọc biến toàn cục L) —
// nếu utils/leafletGlobal.ts nạp sai thứ tự, file test này hỏng ngay ở bước import.

import { describe, it, expect, beforeAll, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import RescueMap from './RescueMap.vue'
import type { SosListItem } from '@/types'

// jsdom không có layout (clientWidth = 0) và không có canvas 2D — Leaflet cần kích thước
// khung để tính vùng nhìn/gom cụm, còn renderer canvas (preferCanvas) + leaflet.heat cần
// getContext('2d'). Giả lập tối thiểu: khung 800x600 và 1 context no-op.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  const ctxGia = new Proxy({} as CanvasRenderingContext2D, {
    get: (_t, ten) =>
      ten === 'getImageData' || ten === 'createImageData'
        ? () => ({ data: new Uint8ClampedArray(4) })
        : ten === 'createLinearGradient'
          ? () => ({ addColorStop: () => undefined })
          : () => undefined,
    set: () => true
  })
  HTMLCanvasElement.prototype.getContext = (() => ctxGia) as unknown as HTMLCanvasElement['getContext']
})

let wrapper: VueWrapper | null = null
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

function sos(id: string, status: SosListItem['status'], lat = 11.9465, lng = 108.4419, type: SosListItem['type'] = 'flood'): SosListItem {
  return {
    id,
    type,
    status,
    ward_code: '24781',
    created_at: '2026-09-28T08:00:00Z',
    lat,
    lng,
    location_estimated: false,
    victim_name: 'Nguyễn Văn A',
    victim_phone: '0900000001'
  }
}

function gan(props: {
  sosList: SosListItem[]
  gomCum?: boolean
  heatmap?: [number, number, number][] | null
}): VueWrapper {
  wrapper = mount(RescueMap, { props: { teams: [], ...props }, attachTo: document.body })
  return wrapper
}

describe('RescueMap — marker SOS', () => {
  it('vẽ đủ marker cho mọi SOS và bấm marker thì emit select-sos', async () => {
    const w = gan({ sosList: [sos('a', 'pending', 11.9, 108.4), sos('b', 'assigned', 11.95, 108.45)] })
    const dots = document.querySelectorAll('.sos-dot')
    expect(dots).toHaveLength(2)

    const icon = dots[0].closest('.leaflet-marker-icon') as HTMLElement
    icon.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(w.emitted('select-sos')?.[0]).toEqual(['a'])
  })

  it('SOS mới thêm vào danh sách thì hiện thêm marker', async () => {
    const w = gan({ sosList: [sos('a', 'pending')] })
    await w.setProps({ sosList: [sos('a', 'pending'), sos('b', 'resolved', 12.1, 108.6)] })
    expect(document.querySelectorAll('.sos-dot')).toHaveLength(2)
  })
})

describe('RescueMap — gom cụm (F-MAP-05)', () => {
  it('cụm lấy màu SOS gấp nhất và đếm số SOS đang chờ', () => {
    // 3 SOS cùng một chỗ → chắc chắn gom thành 1 cụm ở zoom 9.
    gan({
      gomCum: true,
      sosList: [sos('a', 'resolved'), sos('b', 'pending'), sos('c', 'pending')]
    })
    const cum = document.querySelector('.sos-cum')
    expect(cum).not.toBeNull()
    expect(cum?.classList.contains('sos-cum--gap')).toBe(true)
    expect(cum?.querySelector('.sos-cum__loi')?.textContent).toBe('3')
    expect(cum?.querySelector('.sos-cum__cho')?.textContent).toBe('2')
    // Marker lẻ bị gộp vào cụm, không còn nằm riêng trên bản đồ.
    expect(document.querySelectorAll('.sos-dot')).toHaveLength(0)
  })

  it('cụm không có SOS chờ xử lý thì không có badge đỏ', () => {
    gan({ gomCum: true, sosList: [sos('a', 'resolved'), sos('b', 'arrived')] })
    const cum = document.querySelector('.sos-cum')
    expect(cum?.classList.contains('sos-cum--gap')).toBe(false)
    expect(cum?.querySelector('.sos-cum__cho')).toBeNull()
  })
})

describe('RescueMap — bản đồ nhiệt (F-MAP-03)', () => {
  it('bật heatmap thì ẩn marker SOS, tắt thì hiện lại', async () => {
    const w = gan({ sosList: [sos('a', 'pending')] })
    expect(document.querySelectorAll('.sos-dot')).toHaveLength(1)

    await w.setProps({ heatmap: [[11.9465, 108.4419, 3]] })
    expect(document.querySelectorAll('.sos-dot')).toHaveLength(0)
    expect(document.querySelector('.leaflet-heatmap-layer')).not.toBeNull()

    await w.setProps({ heatmap: null })
    expect(document.querySelectorAll('.sos-dot')).toHaveLength(1)
    expect(document.querySelector('.leaflet-heatmap-layer')).toBeNull()
  })
})

describe('RescueMap — icon theo loại SOS (SRS F-MAP-01 "custom icon theo loại SOS")', () => {
  it('mỗi loại sự cố có biểu tượng riêng; viền vẫn theo màu trạng thái', () => {
    gan({
      sosList: [
        sos('a', 'pending', 11.9, 108.4, 'landslide'),
        sos('b', 'resolved', 12.1, 108.7, 'fire')
      ]
    })
    const dots = Array.from(document.querySelectorAll<HTMLElement>('.sos-dot'))
    const theoLoai = Object.fromEntries(dots.map((d) => [d.dataset.loai, d]))
    expect(theoLoai.landslide.textContent).toContain('⛰')
    expect(theoLoai.fire.textContent).toContain('🔥')
    // pending (đỏ) và resolved (xanh lá) → viền khác màu nhau
    expect(theoLoai.landslide.style.borderColor).not.toBe(theoLoai.fire.style.borderColor)
  })
})

// Cập nhật marker theo id: trước đây mỗi lần danh sách SOS đổi (socket bắn liên tục ở
// Dashboard) là xoá SẠCH lớp marker rồi dựng lại từng cái + tính lại cụm — vừa tốn, vừa làm
// cụm commander đang mở bị đóng lại. Giờ chỉ marker thật sự thay đổi mới bị đụng tới.
// Nhận biết "có bị dựng lại không" bằng chính phần tử DOM: giữ nguyên node = không dựng lại.
describe('RescueMap — cập nhật marker theo id', () => {
  function nodeSos(loai: string): HTMLElement | null {
    return document.querySelector(`[data-loai="${loai}"]`)?.closest<HTMLElement>('.leaflet-marker-icon') ?? null
  }
  const ds = () => [
    sos('a', 'pending', 11.9, 108.4, 'flood'),
    sos('b', 'assigned', 11.95, 108.45, 'fire'),
    sos('c', 'resolved', 12.0, 108.5, 'landslide')
  ]

  it('đổi trạng thái 1 SOS: chỉ marker đó đổi viền, các marker khác giữ nguyên node', async () => {
    const w = gan({ sosList: ds() })
    const truocB = nodeSos('fire')
    const truocC = nodeSos('landslide')
    const vienCu = document.querySelector<HTMLElement>('[data-loai="flood"]')?.style.borderColor

    const moi = ds()
    moi[0] = sos('a', 'resolved', 11.9, 108.4, 'flood')
    await w.setProps({ sosList: moi })

    expect(document.querySelectorAll('.sos-dot')).toHaveLength(3)
    expect(document.querySelector<HTMLElement>('[data-loai="flood"]')?.style.borderColor).not.toBe(vienCu)
    expect(nodeSos('fire')).toBe(truocB)
    expect(nodeSos('landslide')).toBe(truocC)
  })

  it('danh sách mới có cùng nội dung (object mới) thì không dựng lại marker nào', async () => {
    const w = gan({ sosList: ds() })
    const truoc = ['flood', 'fire', 'landslide'].map(nodeSos)
    await w.setProps({ sosList: ds() })
    expect(['flood', 'fire', 'landslide'].map(nodeSos)).toEqual(truoc)
    truoc.forEach((n, i) => expect(['flood', 'fire', 'landslide'].map(nodeSos)[i]).toBe(n))
  })

  it('SOS bị loại khỏi danh sách thì marker biến mất, các marker còn lại giữ nguyên', async () => {
    const w = gan({ sosList: ds() })
    const truocB = nodeSos('fire')
    await w.setProps({ sosList: ds().filter((s) => s.id !== 'a') })
    expect(nodeSos('flood')).toBeNull()
    expect(document.querySelectorAll('.sos-dot')).toHaveLength(2)
    expect(nodeSos('fire')).toBe(truocB)
  })

  it('chọn SOS chỉ làm marker được chọn (và marker vừa bỏ chọn) đổi, không dựng lại cả lớp', async () => {
    const w = gan({ sosList: ds(), selectedSosId: 'a' } as never)
    const truocC = nodeSos('landslide')
    expect(document.querySelector('[data-loai="flood"]')?.classList.contains('sos-dot--chon')).toBe(true)

    await w.setProps({ selectedSosId: 'b' })
    expect(document.querySelector('[data-loai="flood"]')?.classList.contains('sos-dot--chon')).toBe(false)
    expect(document.querySelector('[data-loai="fire"]')?.classList.contains('sos-dot--chon')).toBe(true)
    expect(nodeSos('landslide')).toBe(truocC)
  })

  it('trong cụm: đổi 1 SOS sang pending thì cụm cập nhật màu gấp + badge đếm', async () => {
    const w = gan({
      gomCum: true,
      sosList: [sos('a', 'resolved'), sos('b', 'resolved'), sos('c', 'resolved')]
    })
    expect(document.querySelector('.sos-cum')?.classList.contains('sos-cum--gap')).toBe(false)

    await w.setProps({ sosList: [sos('a', 'resolved'), sos('b', 'pending'), sos('c', 'resolved')] })
    const cum = document.querySelector('.sos-cum')
    expect(cum?.classList.contains('sos-cum--gap')).toBe(true)
    expect(cum?.querySelector('.sos-cum__cho')?.textContent).toBe('1')
    expect(cum?.querySelector('.sos-cum__loi')?.textContent).toBe('3')
  })
})
