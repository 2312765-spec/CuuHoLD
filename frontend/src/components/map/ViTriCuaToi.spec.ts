// Nút "Vị trí của tôi": xem vị trí hiện tại trên bản đồ mà KHÔNG gửi SOS. Khoá:
// - bấm → xin vị trí (enableHighAccuracy, 15 giây), vẽ chấm + vòng sai số, bay tới zoom ~15;
// - lỗi 1/2/3 và trang không https → thông báo tiếng Việt có cách khắc phục, không lặp;
// - "theo dõi" mặc định tắt, bật mới watchPosition, rời trang thì clearWatch;
// - lọc nhiễu: điểm nhảy bất thường không làm chấm xanh nhảy theo;
// - chỉnh tay chỉ đổi hiển thị;
// - TUYỆT ĐỐI không có request mạng nào (vị trí chỉ ở trên máy);
// - có nguồn GPS sẵn (RescuerView) thì không tự mở watcher nào.
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import L from 'leaflet'
import { http } from '@/services/http'
import ViTriCuaToi from './ViTriCuaToi.vue'
import type { DiemGps } from '@/utils/locViTri'

// jsdom không có layout/canvas — giả lập tối thiểu như RescueMap.spec.ts.
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  const ctxGia = new Proxy({} as CanvasRenderingContext2D, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctxGia) as unknown as HTMLCanvasElement['getContext']
})

type OkCb = (p: GeolocationPosition) => void
type LoiCb = (e: GeolocationPositionError) => void

const geo = {
  getCurrentPosition: vi.fn<(ok: OkCb, loi?: LoiCb, opt?: PositionOptions) => void>(),
  watchPosition: vi.fn<(ok: OkCb, loi?: LoiCb, opt?: PositionOptions) => number>(() => 42),
  clearWatch: vi.fn<(id: number) => void>()
}

function viTri(lat: number, lng: number, accuracy: number, timestamp = Date.now()): GeolocationPosition {
  return { coords: { latitude: lat, longitude: lng, accuracy }, timestamp } as GeolocationPosition
}
function loiGps(code: number): GeolocationPositionError {
  return { code, message: '', PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError
}

let map: L.Map
let w: VueWrapper | null = null
let goiMang: string[]

function gan(props: { nguonNgoai?: DiemGps | null } = {}): VueWrapper {
  w = mount(ViTriCuaToi, { props: { map, ...props }, attachTo: document.body })
  return w
}
const nut = () => document.querySelector<HTMLButtonElement>('button[aria-label="Vị trí của tôi"]')
const nutTheoNhan = (nhan: string) =>
  [...document.querySelectorAll<HTMLButtonElement>('.vi-tri button')].find((b) => b.textContent?.trim() === nhan)
const cacLop = <T extends L.Layer>(lop: new (...a: never[]) => T) => {
  const kq: T[] = []
  map.eachLayer((l) => {
    if (l instanceof lop) kq.push(l)
  })
  return kq
}
// L.Circle kế thừa L.CircleMarker — tách riêng chấm (CircleMarker thuần) khỏi vòng sai số.
const vongSaiSo = () => cacLop(L.Circle)
const chamXanh = () => cacLop(L.CircleMarker).filter((l) => !(l instanceof L.Circle))

beforeEach(() => {
  const khung = document.createElement('div')
  document.body.appendChild(khung)
  // preferCanvas như bản đồ thật ở cả 3 màn — jsdom không có renderer SVG.
  map = L.map(khung, { zoomControl: true, preferCanvas: true }).setView([11.9465, 108.4419], 9)
  geo.getCurrentPosition.mockReset()
  geo.watchPosition.mockReset().mockReturnValue(42)
  geo.clearWatch.mockReset()
  // Proxy về navigator thật (getter userAgent… đòi `this` là Navigator thật), chỉ thay geolocation.
  const navThat = navigator
  vi.stubGlobal('navigator', new Proxy(navThat, { get: (t, k) => (k === 'geolocation' ? geo : Reflect.get(t, k, t)) }))
  vi.stubGlobal('isSecureContext', true)
  // Bắt MỌI đường ra mạng: axios (http.ts), fetch, XHR.
  goiMang = []
  http.defaults.adapter = async (config) => {
    goiMang.push(`axios ${config.url}`)
    throw new Error('không được gọi mạng')
  }
  vi.stubGlobal('fetch', vi.fn((u: unknown) => {
    goiMang.push(`fetch ${String(u)}`)
    return Promise.reject(new Error('không được gọi mạng'))
  }))
  vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation((_m: string, u: string | URL) => {
    goiMang.push(`xhr ${String(u)}`)
  })
})

afterEach(async () => {
  w?.unmount()
  w = null
  // Đợi canvas Leaflet vẽ xong rồi mới huỷ bản đồ. Lỗi "_ctx undefined" sau test tái hiện được
  // bằng Leaflet thuần trong jsdom (thêm circleMarker → setView đổi zoom → map.remove()), không
  // liên quan component — chỉ là chuyện dọn dẹp môi trường test.
  await new Promise((r) => setTimeout(r, 50))
  map.remove()
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('ViTriCuaToi — bấm nút', () => {
  it('nằm trong khung control Leaflet cùng góc với nút zoom (Leaflet xếp chồng, không đè)', () => {
    gan()
    const goc = document.querySelector('.leaflet-top.leaflet-left')
    expect(goc?.querySelector('.leaflet-control-zoom')).not.toBeNull()
    expect(goc?.querySelector('button[aria-label="Vị trí của tôi"]')).not.toBeNull()
  })

  it('xin vị trí độ chính xác cao, timeout 15 giây; có chấm + vòng sai số, bay tới zoom ≥ 15', async () => {
    gan()
    nut()?.click()
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(geo.getCurrentPosition.mock.calls[0][2]).toMatchObject({ enableHighAccuracy: true, timeout: 15000 })

    geo.getCurrentPosition.mock.calls[0][0](viTri(11.95, 108.45, 35))
    await nextTick()

    expect(chamXanh()).toHaveLength(1)
    expect(chamXanh()[0].getLatLng()).toMatchObject({ lat: 11.95, lng: 108.45 })
    expect(vongSaiSo()).toHaveLength(1)
    expect(vongSaiSo()[0].getRadius()).toBe(35)
    expect(map.getZoom()).toBeGreaterThanOrEqual(15)
    const bang = document.querySelector('.vi-tri')?.textContent ?? ''
    expect(bang).toContain('±35 m')
    expect(bang).toContain('Vị trí chỉ hiển thị trên máy bạn, chưa gửi đi đâu.')
    expect(bang).not.toContain('Độ chính xác thấp')
  })

  it('sai số > 100 m → cảnh báo "Độ chính xác thấp"', async () => {
    gan()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[0][0](viTri(11.95, 108.45, 150))
    await nextTick()
    expect(document.querySelector('.vi-tri')?.textContent).toContain('Độ chính xác thấp')
  })

  it('bấm lần nữa: căn lại giữa, không xin vị trí lại', async () => {
    gan()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[0][0](viTri(11.95, 108.45, 20))
    await nextTick()
    map.setView([11.5, 108.0], 12)
    nut()?.click()
    expect(geo.getCurrentPosition).toHaveBeenCalledTimes(1)
    expect(map.getCenter().lat).toBeCloseTo(11.95, 3)
    expect(map.getCenter().lng).toBeCloseTo(108.45, 3)
  })
})

describe('ViTriCuaToi — lỗi', () => {
  it.each([
    [1, 'từ chối quyền vị trí', 'cho phép'],
    [2, 'Không xác định được vị trí', 'Bật GPS'],
    [3, 'Quá 15 giây', 'chỗ thoáng']
  ])('mã %i → thông báo tiếng Việt kèm cách khắc phục', async (ma, cau, cachSua) => {
    gan()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[0][1]?.(loiGps(ma))
    await nextTick()
    const loi = document.querySelectorAll('.vi-tri [role="alert"]')
    expect(loi).toHaveLength(1)
    expect(loi[0].textContent).toContain(cau)
    expect(loi[0].textContent).toContain(cachSua)
  })

  it('lỗi lặp lại không nhân bản thông báo', async () => {
    gan()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[0][1]?.(loiGps(3))
    await nextTick()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[1][1]?.(loiGps(3))
    await nextTick()
    expect(document.querySelectorAll('.vi-tri [role="alert"]')).toHaveLength(1)
  })

  it('trang không an toàn (http, không phải localhost) → báo cần https, không gọi định vị', async () => {
    vi.stubGlobal('isSecureContext', false)
    gan()
    nut()?.click()
    await nextTick()
    expect(geo.getCurrentPosition).not.toHaveBeenCalled()
    expect(document.querySelector('.vi-tri [role="alert"]')?.textContent).toContain('https://')
  })
})

describe('ViTriCuaToi — theo dõi', () => {
  async function coViTri(): Promise<void> {
    gan()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[0][0](viTri(11.95, 108.45, 10, 1_000_000))
    await nextTick()
  }

  it('mặc định TẮT: chưa có watchPosition nào', async () => {
    await coViTri()
    expect(geo.watchPosition).not.toHaveBeenCalled()
    expect(document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.checked).toBe(false)
  })

  it('bật theo dõi → watchPosition; rời trang → clearWatch đúng id', async () => {
    await coViTri()
    document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.click()
    await nextTick()
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    w?.unmount()
    w = null
    expect(geo.clearWatch).toHaveBeenCalledWith(42)
  })

  it('lọc nhiễu: điểm nhảy bất thường bị bỏ, điểm di chuyển bình thường được nhận', async () => {
    await coViTri()
    document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.click()
    await nextTick()
    const capNhat = geo.watchPosition.mock.calls[0][0]
    capNhat(viTri(12.2, 108.45, 10, 1_005_000)) // ~28 km sau 5 giây
    await nextTick()
    expect(chamXanh()[0].getLatLng().lat).toBeCloseTo(11.95, 5)
    capNhat(viTri(11.951, 108.45, 10, 1_030_000)) // ~110 m sau 30 giây
    await nextTick()
    expect(chamXanh()[0].getLatLng().lat).toBeCloseTo(11.951, 5)
  })

  it('lọc nhiễu: điểm sai số lớn bị bỏ khi vừa có điểm tốt hơn', async () => {
    await coViTri()
    document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.click()
    await nextTick()
    geo.watchPosition.mock.calls[0][0](viTri(11.9505, 108.45, 400, 1_010_000))
    await nextTick()
    expect(vongSaiSo()[0].getRadius()).toBe(10)
  })
})

describe('ViTriCuaToi — chỉnh tay + không gọi mạng', () => {
  it('kéo ghim chỉnh tay → nhãn "đã chỉnh tay", chấm GPS giữ nguyên, không có request nào', async () => {
    gan()
    nut()?.click()
    geo.getCurrentPosition.mock.calls[0][0](viTri(11.95, 108.45, 30))
    await nextTick()
    nutTheoNhan('Chỉnh vị trí')?.click()
    await nextTick()
    const ghim = cacLop(L.Marker).find((m) => m.options.draggable)
    expect(ghim).toBeDefined()
    ghim?.setLatLng([11.96, 108.46])
    ghim?.fire('dragend')
    await nextTick()
    expect(document.querySelector('.vi-tri')?.textContent).toContain('đã chỉnh tay')
    expect(chamXanh()[0].getLatLng()).toMatchObject({ lat: 11.95, lng: 108.45 })

    document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.click()
    await nextTick()
    await new Promise((r) => setTimeout(r, 0))
    expect(goiMang).toEqual([])
  })
})

describe('ViTriCuaToi — dùng nguồn GPS có sẵn (RescuerView)', () => {
  const diem: DiemGps = { lat: 11.93, lng: 108.43, saiSoM: 12, thoiDiem: 1_000_000 }

  it('bấm nút dùng điểm có sẵn: không getCurrentPosition, không watchPosition', async () => {
    gan({ nguonNgoai: diem })
    nut()?.click()
    await nextTick()
    expect(chamXanh()[0].getLatLng()).toMatchObject({ lat: 11.93, lng: 108.43 })
    document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.click()
    await nextTick()
    expect(geo.getCurrentPosition).not.toHaveBeenCalled()
    expect(geo.watchPosition).not.toHaveBeenCalled()
  })

  it('chưa có điểm → báo đang chờ; điểm tới thì vẽ', async () => {
    const wr = gan({ nguonNgoai: null })
    nut()?.click()
    await nextTick()
    expect(document.querySelector('.vi-tri')?.textContent).toContain('Đang lấy vị trí')
    await wr.setProps({ nguonNgoai: diem })
    expect(chamXanh()).toHaveLength(1)
    expect(geo.watchPosition).not.toHaveBeenCalled()
  })
})
