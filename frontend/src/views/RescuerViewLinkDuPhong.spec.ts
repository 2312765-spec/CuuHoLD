// Màn hình rescuer: link Google Maps chỉ là phương án DỰ PHÒNG. Khi tuyến đường bộ thật đã vẽ được
// trên bản đồ của app thì KHÔNG hiện link (rescuer không bị đẩy sang app khác); link chỉ hiện khi
// đường bộ trong app không dùng được — ORS lỗi/thiếu key, hoặc không lấy được GPS — vì lúc đó app
// chỉ còn đường chim bay, không dẫn đường được. Toạ độ nạn nhân luôn hiện dạng chữ.

import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import RescuerView from './RescuerView.vue'
import RescueMap from '@/components/map/RescueMap.vue'
import * as sosService from '@/services/sosService'
import * as rescueTeamsService from '@/services/rescueTeamsService'
import * as routingService from '@/services/routingService'
import * as hazardsService from '@/services/hazardsService'
import type { RescueTeam, RouteResult, SosListItem, SosRequest } from '@/types'

vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(),
  xemChiTietSos: vi.fn(),
  capNhatTienDo: vi.fn()
}))
vi.mock('@/services/rescueTeamsService', () => ({
  fetchRescueTeams: vi.fn(),
  capNhatViTriDoi: vi.fn()
}))
vi.mock('@/services/routingService', () => ({ layTuyenDuongThat: vi.fn() }))
vi.mock('@/services/hazardsService', () => ({ layCanhBaoDangHoatDong: vi.fn() }))
vi.mock('@/composables/useSocket', async () => {
  const { ref } = await import('vue')
  return { useSocket: () => ({ isConnected: ref(false), connect: vi.fn() }) }
})
vi.mock('@/stores/auth.store', () => ({
  useAuthStore: () => ({ user: { id: 'leader-1', name: 'Trưởng đội thử' }, logout: vi.fn() })
}))

const DOI: RescueTeam = {
  id: 'team-1',
  name: 'Đội thử',
  status: 'busy',
  specialties: [],
  ward_code: '24781',
  lat: 12.0091,
  lng: 108.422,
  leader_id: 'leader-1',
  leader_name: 'Trưởng đội thử',
  leader_phone: '0900000222'
}

const SOS: SosRequest = {
  id: 'sos-1',
  victim_id: 'victim-1',
  type: 'medical',
  status: 'assigned',
  description: null,
  image_url: null,
  ward_code: '24781',
  cancel_deadline: '2026-01-01T00:03:00.000Z',
  location_estimated: false,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  resolved_at: null,
  lat: 11.9465,
  lng: 108.4419,
  assigned_team_id: 'team-1',
  victim_name: 'Nạn nhân thử',
  victim_phone: '0900000001'
}

const TUYEN: RouteResult = {
  distance_meters: 10090,
  duration_seconds: 732,
  geometry: [
    [12.0091, 108.422],
    [11.9465, 108.4419]
  ],
  instructions: [{ text: 'Rẽ phải', distance_meters: 500, lat: 12.0, lng: 108.43 }]
}

const LINK_GOOGLE = 'https://www.google.com/maps/dir/?api=1&destination=11.9465,108.4419'

// ---- GPS giả: test tự bắn kết quả/lỗi qua đúng callback mà component đã đăng ký cho watchPosition ----
let baoViTri: (pos: GeolocationPosition) => void
let baoLoiViTri: (err: GeolocationPositionError) => void
const watchPosition = vi.fn(
  (
    ok: (pos: GeolocationPosition) => void,
    err: (e: GeolocationPositionError) => void
  ): number => {
    baoViTri = ok
    baoLoiViTri = err
    return 1
  }
)
const clearWatch = vi.fn()

function datGeolocation(value: unknown): void {
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value })
}

async function coViTri(lat: number, lng: number): Promise<void> {
  baoViTri({ coords: { latitude: lat, longitude: lng } } as GeolocationPosition)
  await flushPromises()
}

let wrapper: VueWrapper | null = null

async function mountManHinh(): Promise<VueWrapper> {
  vi.mocked(rescueTeamsService.fetchRescueTeams).mockResolvedValue([DOI])
  vi.mocked(sosService.layDanhSachSos).mockResolvedValue([{ id: SOS.id } as SosListItem])
  vi.mocked(sosService.xemChiTietSos).mockResolvedValue(SOS)
  vi.mocked(hazardsService.layCanhBaoDangHoatDong).mockResolvedValue([])
  wrapper = mount(RescuerView, {
    global: { plugins: [createPinia()], stubs: { RescueMap: true, RouterLink: true } }
  })
  await flushPromises()
  return wrapper
}

function linkGoogle(w: VueWrapper) {
  return w.findAll('a').filter((a) => (a.attributes('href') ?? '').includes('google.com/maps'))
}

describe('RescuerView — link Google Maps chỉ là dự phòng', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    datGeolocation({ watchPosition, clearWatch })
  })

  afterEach(() => {
    wrapper?.unmount() // dừng watchPosition + interval 30s, tránh rò rỉ giữa các test
    wrapper = null
    vi.useRealTimers()
  })

  it('chưa có GPS lần đầu → chưa hiện link (tránh hiện rồi biến mất khi đường bộ về tới)', async () => {
    const w = await mountManHinh()

    expect(watchPosition).toHaveBeenCalledTimes(1)
    expect(linkGoogle(w)).toHaveLength(0)
    expect(w.get('.map-hint').text()).toContain('Đang chờ vị trí GPS')
  })

  it('đường bộ thật vẽ được trên bản đồ của app → KHÔNG hiện link Google Maps, vẫn hiện toạ độ', async () => {
    vi.mocked(routingService.layTuyenDuongThat).mockResolvedValue(TUYEN)
    const w = await mountManHinh()

    await coViTri(12.0091, 108.422)

    expect(routingService.layTuyenDuongThat).toHaveBeenCalledWith(
      { lat: 12.0091, lng: 108.422 },
      { lat: 11.9465, lng: 108.4419 }
    )
    // Tuyến được đưa vào bản đồ của app (Leaflet) — không phải mở app khác.
    expect(w.findComponent(RescueMap).props('routeThat')).toEqual(TUYEN)
    expect(linkGoogle(w)).toHaveLength(0)
    expect(w.text()).toContain('11.94650, 108.44190')
    expect(w.get('.map-hint').text()).toContain('Đường liền')
  })

  it('ORS lỗi/thiếu key (trả null) → hiện link Google Maps dự phòng và nói rõ đó là dự phòng', async () => {
    vi.mocked(routingService.layTuyenDuongThat).mockResolvedValue(null)
    const w = await mountManHinh()

    await coViTri(12.0091, 108.422)

    const links = linkGoogle(w)
    expect(links).toHaveLength(1)
    expect(links[0].attributes('href')).toBe(LINK_GOOGLE)
    expect(links[0].text()).toContain('dự phòng')
    expect(w.get('.map-hint').text()).toContain('Google Maps (dự phòng)')
    expect(w.findComponent(RescueMap).props('routeThat')).toBeNull()
  })

  it('GPS bị từ chối/không lấy được → hiện link dự phòng (app không có điểm xuất phát để vẽ đường)', async () => {
    const w = await mountManHinh()

    baoLoiViTri({ code: 1, message: 'denied' } as GeolocationPositionError)
    await flushPromises()

    const links = linkGoogle(w)
    expect(links).toHaveLength(1)
    expect(links[0].text()).toContain('dự phòng')
    expect(w.get('.map-hint').text()).toContain('Không lấy được vị trí GPS')
    expect(routingService.layTuyenDuongThat).not.toHaveBeenCalled()
  })

  it('trình duyệt không hỗ trợ định vị → hiện link dự phòng', async () => {
    datGeolocation(undefined)
    const w = await mountManHinh()

    expect(watchPosition).not.toHaveBeenCalled()
    const links = linkGoogle(w)
    expect(links).toHaveLength(1)
    expect(links[0].text()).toContain('dự phòng')
  })

  it('đường bộ lỗi rồi phục hồi ở lần làm mới 30 giây kế tiếp → link tự biến mất', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }) // chỉ giả interval, flushPromises vẫn chạy
    vi.mocked(routingService.layTuyenDuongThat).mockResolvedValue(null)
    const w = await mountManHinh()
    await coViTri(12.0091, 108.422)
    expect(linkGoogle(w)).toHaveLength(1)

    vi.mocked(routingService.layTuyenDuongThat).mockResolvedValue(TUYEN)
    vi.advanceTimersByTime(30000)
    await flushPromises()

    expect(linkGoogle(w)).toHaveLength(0)
    expect(w.findComponent(RescueMap).props('routeThat')).toEqual(TUYEN)
  })

  it('đang làm mới đường bộ mà lần trước đã lỗi → link KHÔNG nháy tắt rồi bật lại mỗi 30 giây', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
    vi.mocked(routingService.layTuyenDuongThat).mockResolvedValue(null)
    const w = await mountManHinh()
    await coViTri(12.0091, 108.422)
    expect(linkGoogle(w)[0].text()).toContain('dự phòng')

    // Lần làm mới kế tiếp treo (chưa có kết quả) — link vẫn phải còn đó.
    vi.mocked(routingService.layTuyenDuongThat).mockReturnValue(new Promise(() => undefined))
    vi.advanceTimersByTime(30000)
    await flushPromises()

    const links = linkGoogle(w)
    expect(links).toHaveLength(1)
    expect(links[0].text()).toContain('dự phòng')
  })
})
