// RescuerView đã có watchPosition (gửi vị trí đội mỗi 30 giây). Nút "Vị trí của tôi" phải dùng
// lại đúng watcher đó — 2 watcher độ chính xác cao cùng lúc chỉ tốn pin gấp đôi — và không gọi
// API nào ngoài những gì RescuerView vốn gọi. Mount với RescueMap THẬT (Leaflet trong jsdom).
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import type { SosRequest } from '@/types'

vi.mock('@/services/sosService', () => ({
  layDanhSachSos: vi.fn(async () => [{ id: 'a', status: 'assigned' }]),
  xemChiTietSos: vi.fn(async (id: string) => ({
    id, type: 'flood', status: 'assigned', ward_code: '24778', created_at: '2026-10-02T08:00:00Z',
    lat: 11.9, lng: 108.4, location_estimated: false, victim_name: 'A', victim_phone: '0900000001',
    assigned_team_id: 't1'
  }) as SosRequest),
  capNhatTienDo: vi.fn()
}))
vi.mock('@/services/rescueTeamsService', () => ({
  fetchRescueTeams: vi.fn(async () => [{ id: 't1', name: 'Đội 1', status: 'busy', leader_id: 'u1' }]),
  capNhatViTriDoi: vi.fn()
}))
vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import { capNhatViTriDoi } from '@/services/rescueTeamsService'
import { useAuthStore } from '@/stores/auth.store'
import RescuerView from './RescuerView.vue'

beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 600 })
  const ctxGia = new Proxy({} as CanvasRenderingContext2D, { get: () => () => undefined, set: () => true })
  HTMLCanvasElement.prototype.getContext = (() => ctxGia) as unknown as HTMLCanvasElement['getContext']
})

const geo = {
  getCurrentPosition: vi.fn(),
  watchPosition: vi.fn((ok: (p: GeolocationPosition) => void) => {
    ok({ coords: { latitude: 11.95, longitude: 108.45, accuracy: 18 }, timestamp: 1_000_000 } as GeolocationPosition)
    return 7
  }),
  clearWatch: vi.fn()
}

let w: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  geo.getCurrentPosition.mockClear()
  geo.watchPosition.mockClear()
  const navThat = navigator
  vi.stubGlobal('navigator', new Proxy(navThat, { get: (t, k) => (k === 'geolocation' ? geo : Reflect.get(t, k, t)) }))
  vi.stubGlobal('isSecureContext', true)
  useAuthStore().setAuth({
    accessToken: 'a', refreshToken: 'r',
    user: { id: 'u1', phone: '0900000002', name: 'Tên', role: 'rescuer', wardCode: '24778', isActive: true, createdAt: '', updatedAt: '' }
  })
})

afterEach(async () => {
  // Đợi canvas Leaflet vẽ xong trước khi tháo (bản đồ huỷ ngay trong unmount) — xem ghi chú
  // dọn dẹp canvas jsdom ở ViTriCuaToi.spec.ts.
  await new Promise((r) => setTimeout(r, 50))
  w?.unmount()
  w = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

describe('RescuerView — nút Vị trí của tôi', () => {
  it('dùng lại watcher sẵn có: bấm nút + bật theo dõi vẫn chỉ 1 watchPosition, không getCurrentPosition', async () => {
    w = mount(RescuerView, {
      attachTo: document.body,
      global: { stubs: { AnhHienTruong: true, RouterLink: { template: '<a><slot /></a>' } } }
    })
    await flushPromises()
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)

    const nut = document.querySelector<HTMLButtonElement>('button[aria-label="Vị trí của tôi"]')
    expect(nut).not.toBeNull()
    nut?.click()
    await nextTick()
    document.querySelector<HTMLInputElement>('.vi-tri input[type="checkbox"]')?.click()
    await nextTick()

    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    expect(geo.getCurrentPosition).not.toHaveBeenCalled()
    expect(document.querySelector('.vi-tri')?.textContent).toContain('±18 m')
    // Không phát sinh cập nhật vị trí đội ngoài chu kỳ 30 giây sẵn có.
    expect(capNhatViTriDoi).not.toHaveBeenCalled()
  })
})
