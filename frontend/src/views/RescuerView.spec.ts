// Khoá hành vi RescuerView (SRS 6.1, CLAUDE.md Mục 8): danh sách nhiệm vụ của đội mình, đổi
// tiến độ từng bước, báo lỗi tiếng Việt, và gửi GPS đội mỗi 30 giây (dừng khi rời trang).
// Đi qua http.ts THẬT (interceptor + thongBaoLoi) bằng adapter axios giả — để kiểm "lỗi API
// hiện thông báo" đúng như người dùng thấy, thay vì mock service rồi tự tin nhầm.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios'

vi.mock('@/composables/useSocket', () => ({
  useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: { value: true } })
}))

import { http } from '@/services/http'
import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import RescuerView from './RescuerView.vue'

const USER_ID = 'user-leader'
const TEAM_ID = 'team-1'

interface LoiGia {
  status: number
  data: unknown
}

let cuocGoi: { method: string; url: string; body: unknown }[]
let trangThaiTheoSos: Record<string, string>
let loiKhiDoiTienDo: LoiGia | null

function chiTietSos(id: string, status: string) {
  return {
    id, type: 'flood', status, description: null, image_url: null, ward_code: '24778',
    location_estimated: false, created_at: '2026-10-02T08:00:00Z', lat: 11.9, lng: 108.4,
    assigned_team_id: TEAM_ID, victim_name: `Nạn nhân ${id}`, victim_phone: '0900000001'
  }
}

// Adapter thay cho mạng: định tuyến theo method + url, ghi lại mọi cuộc gọi.
const adapterGia: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
  const method = (config.method ?? 'get').toLowerCase()
  const url = config.url ?? ''
  const body = typeof config.data === 'string' ? JSON.parse(config.data) : config.data
  cuocGoi.push({ method, url, body })
  const ok = (data: unknown) => ({ data: { success: true, data, message: 'OK' }, status: 200, statusText: 'OK', headers: {}, config })

  if (method === 'get' && url === '/rescue-teams') {
    return ok([{ id: TEAM_ID, name: 'Đội 1', status: 'busy', leader_id: USER_ID }])
  }
  if (method === 'get' && url === '/sos') {
    return ok(Object.keys(trangThaiTheoSos).map((id) => ({ id, status: trangThaiTheoSos[id] })))
  }
  const chiTiet = url.match(/^\/sos\/([^/]+)$/)
  if (method === 'get' && chiTiet) return ok(chiTietSos(chiTiet[1], trangThaiTheoSos[chiTiet[1]]))
  const tienDo = url.match(/^\/sos\/([^/]+)\/status$/)
  if (method === 'patch' && tienDo) {
    if (loiKhiDoiTienDo) {
      const response = { data: loiKhiDoiTienDo.data, status: loiKhiDoiTienDo.status, statusText: '', headers: {}, config }
      throw new AxiosError('loi', 'ERR_BAD_RESPONSE', config, null, response)
    }
    return ok({ sosId: tienDo[1], status: (body as { status: string }).status, updatedAt: '2026-10-02T09:00:00Z' })
  }
  if (method === 'patch' && url === `/rescue-teams/${TEAM_ID}/location`) {
    return ok({ teamId: TEAM_ID, wardCode: '24778', ...(body as object), updatedAt: '2026-10-02T09:00:00Z' })
  }
  throw new Error(`Adapter giả: chưa định tuyến ${method} ${url}`)
}

const geo = {
  watchPosition: vi.fn(),
  clearWatch: vi.fn()
}

async function gan(sos: Record<string, string>): Promise<VueWrapper> {
  trangThaiTheoSos = sos
  const w = mount(RescuerView, {
    global: { stubs: { RescueMap: true, AnhHienTruong: true, RouterLink: { template: '<a><slot /></a>' } } }
  })
  await flushPromises()
  return w
}

const nutTienDo = (w: VueWrapper) => w.findAll('.sos-card .btn-primary')
const locationCalls = () => cuocGoi.filter((c) => c.url === `/rescue-teams/${TEAM_ID}/location`)

beforeEach(() => {
  setActivePinia(createPinia())
  cuocGoi = []
  loiKhiDoiTienDo = null
  http.defaults.adapter = adapterGia
  // Chỉ giả setInterval: toast store + flushPromises vẫn dùng timer thật.
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  geo.watchPosition.mockReset()
  geo.clearWatch.mockReset()
  geo.watchPosition.mockImplementation((ok: (p: unknown) => void) => {
    ok({ coords: { latitude: 11.95, longitude: 108.45 } })
    return 7
  })
  Object.defineProperty(navigator, 'geolocation', { configurable: true, value: geo })
  useAuthStore().setAuth({
    accessToken: 't', refreshToken: 'r',
    user: { id: USER_ID, phone: '0900000002', name: 'Trưởng đội', role: 'rescuer', wardCode: '24778', isActive: true, createdAt: '', updatedAt: '' }
  })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('RescuerView — danh sách nhiệm vụ', () => {
  it('hiện đúng nhiệm vụ được giao cho đội mình, kèm nhãn trạng thái tiếng Việt', async () => {
    const w = await gan({ a: 'assigned', b: 'in_progress' })

    const the = w.findAll('.sos-card')
    expect(the).toHaveLength(2)
    expect(the[0].text()).toContain('Nạn nhân a')
    expect(the[0].text()).toContain('Đã phân công')
    expect(the[1].text()).toContain('Đang thực hiện')
    // Chỉ hỏi các trạng thái đang hoạt động — không kéo SOS đã kết thúc về.
    const hoi = cuocGoi.find((c) => c.url === '/sos')
    expect(hoi).toBeDefined()
  })

  it('không có nhiệm vụ → báo rõ, không có thẻ nào', async () => {
    const w = await gan({})
    expect(w.findAll('.sos-card')).toHaveLength(0)
    expect(w.text()).toContain('Chưa có nhiệm vụ nào được phân công.')
  })
})

describe('RescuerView — đổi tiến độ', () => {
  it('đi đủ assigned → in_progress → arrived → resolved, mỗi bước gọi đúng API, resolved thì thẻ biến mất', async () => {
    const w = await gan({ a: 'assigned' })
    const buoc = ['in_progress', 'arrived', 'resolved']
    const nhan = ['Bắt đầu di chuyển', 'Đã đến nơi', 'Hoàn thành cứu hộ']

    for (let i = 0; i < buoc.length; i++) {
      const nut = nutTienDo(w)
      expect(nut).toHaveLength(1)
      expect(nut[0].text()).toBe(nhan[i])
      await nut[0].trigger('click')
      await flushPromises()
      const goi = cuocGoi.filter((c) => c.method === 'patch' && c.url === '/sos/a/status')
      expect(goi[goi.length - 1].body).toMatchObject({ status: buoc[i] })
    }
    expect(w.findAll('.sos-card')).toHaveLength(0)
  })

  it('không nhảy bước: thẻ "assigned" chỉ có nút bước kế tiếp, không có nút "Hoàn thành cứu hộ"', async () => {
    const w = await gan({ a: 'assigned' })
    expect(w.text()).not.toContain('Hoàn thành cứu hộ')
    expect(w.text()).not.toContain('Đã đến nơi')
    expect(nutTienDo(w)[0].text()).toBe('Bắt đầu di chuyển')
  })

  it('lỗi 403 từ server → hiện đúng câu tiếng Việt của server, trạng thái thẻ giữ nguyên, nút bấm lại được', async () => {
    const w = await gan({ a: 'assigned' })
    loiKhiDoiTienDo = { status: 403, data: { statusCode: 403, message: 'SOS chưa được phân công đội cứu hộ' } }

    await nutTienDo(w)[0].trigger('click')
    await flushPromises()

    expect(useToastStore().message).toBe('SOS chưa được phân công đội cứu hộ')
    expect(w.find('.sos-card').text()).toContain('Đã phân công')
    const nut = nutTienDo(w)[0]
    expect(nut.text()).toBe('Bắt đầu di chuyển')
    expect(nut.attributes('disabled')).toBeUndefined()
  })

  it('lỗi 500 → câu "máy chủ gặp sự cố" bằng tiếng Việt, không lộ lỗi kỹ thuật', async () => {
    const w = await gan({ a: 'assigned' })
    loiKhiDoiTienDo = { status: 500, data: { statusCode: 500, message: 'Internal server error' } }

    await nutTienDo(w)[0].trigger('click')
    await flushPromises()

    expect(useToastStore().message).toBe('Máy chủ đang gặp sự cố, vui lòng thử lại sau.')
  })
})

describe('RescuerView — gửi GPS đội mỗi 30 giây', () => {
  it('có nhiệm vụ active → sau 30 giây gọi PATCH /rescue-teams/:id/location với toạ độ mới nhất', async () => {
    await gan({ a: 'assigned' })
    expect(geo.watchPosition).toHaveBeenCalledTimes(1)
    expect(locationCalls()).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(29_000)
    expect(locationCalls()).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(locationCalls()).toHaveLength(1)
    expect(locationCalls()[0].body).toEqual({ lat: 11.95, lng: 108.45 })

    await vi.advanceTimersByTimeAsync(30_000)
    expect(locationCalls()).toHaveLength(2)
  })

  it('không có nhiệm vụ active → không theo dõi GPS, không gửi gì', async () => {
    await gan({})
    expect(geo.watchPosition).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(120_000)
    expect(locationCalls()).toHaveLength(0)
  })

  it('rời trang (unmount) → clearWatch + dừng hẳn việc gửi', async () => {
    const w = await gan({ a: 'assigned' })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(locationCalls()).toHaveLength(1)

    w.unmount()
    expect(geo.clearWatch).toHaveBeenCalledWith(7)
    await vi.advanceTimersByTimeAsync(120_000)
    expect(locationCalls()).toHaveLength(1)
  })

  it('làm xong nhiệm vụ cuối (resolved) → tự dừng theo dõi GPS', async () => {
    const w = await gan({ a: 'arrived' })
    await nutTienDo(w)[0].trigger('click')
    await flushPromises()

    expect(geo.clearWatch).toHaveBeenCalledWith(7)
    const truoc = locationCalls().length
    await vi.advanceTimersByTimeAsync(120_000)
    expect(locationCalls()).toHaveLength(truoc)
  })
})
