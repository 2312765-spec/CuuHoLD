// Khoá phần "keo dính" gửi SOS của MapView.xacNhanGuiSos — chỗ DUY NHẤT nối dialog (chỉ trả
// loại + mô tả) với GPS và API: toạ độ gửi đi phải là toạ độ vừa đo, và khi GPS kém/lỗi thì cờ
// locationEstimated PHẢI bay theo (CLAUDE.md Mục 15.6 P0 — từng âm thầm gửi toạ độ giả).
// Mount MapView thật, mock Leaflet/socket/IndexedDB (jsdom không dựng được bản đồ) và mock
// service ở tầng HTTP cao nhất để kiểm đúng payload gửi lên.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { AxiosError } from 'axios'

vi.mock('vue-router', () => ({ useRoute: () => ({ query: {} }) }))
vi.mock('@/composables/useLeafletMap', async () => {
  const { ref } = await import('vue')
  return {
    useLeafletMap: () => ({
      mapInstance: ref(null),
      boundaryError: ref(null),
      tileError: ref(false),
      initMap: vi.fn(async () => undefined),
      applyLayerVisibility: vi.fn(),
      themMarkerBaoCao: vi.fn(),
      capNhatMarkerSosCuaMinh: vi.fn(),
      capNhatMarkerDoiCuuHo: vi.fn(),
      // Thêm từ main khi merge PR #5: tự zoom tới SOS (15.19) + vẽ cảnh báo đường (15.14).
      phongToToiSosCuaMinh: vi.fn(),
      capNhatCanhBaoDuong: vi.fn(),
      layKhungTinh: () => null,
      destroyMap: vi.fn()
    })
  }
})
vi.mock('@/composables/useGhimViTri', async () => {
  const { ref } = await import('vue')
  return {
    useGhimViTri: () => ({ viTriGhim: ref(null), loiGhim: ref(''), ghimTaiTamBanDo: vi.fn(), xoaGhim: vi.fn() })
  }
})
vi.mock('@/composables/useSocket', async () => {
  const { ref } = await import('vue')
  return { useSocket: () => ({ connect: vi.fn(), disconnect: vi.fn(), isConnected: ref(false) }) }
})
vi.mock('@/stores/vetGps.store', () => ({ useVetGpsStore: () => ({ tomTatChoSos: async () => null }) }))
vi.mock('@/stores/offlineQueue', () => ({
  useOfflineQueueStore: () => ({
    khoiTao: () => () => undefined,
    laySosDangChoGuiGanNhat: async () => null,
    themSosVaoHangDoi: themSosVaoHangDoi,
    xoaSosKhoiHangDoi: vi.fn(),
    soLuongChoGui: 0,
    soLuongSosChoGui: 0
  })
}))
vi.mock('@/utils/geolocation', () => ({ layViTriHienTai: vi.fn() }))
// MapView (main) tải cảnh báo đường khi đã đăng nhập — không liên quan luồng gửi SOS ở đây.
vi.mock('@/services/hazardsService', () => ({ layCanhBaoDangHoatDong: vi.fn(async () => []) }))
vi.mock('@/services/sosService', () => ({
  guiSos: vi.fn(),
  huySos: vi.fn(),
  xemChiTietSos: vi.fn(),
  xemSosDangHoatDongCuaToi: vi.fn(async () => null),
  dinhKemAnhSos: vi.fn()
}))

import { useAuthStore } from '@/stores/auth.store'
import { useToastStore } from '@/stores/toast'
import { layViTriHienTai } from '@/utils/geolocation'
import { guiSos } from '@/services/sosService'
import MapView from './MapView.vue'
import ViTriCuaToi from '@/components/map/ViTriCuaToi.vue'

// vi.mock được kéo lên đầu file nên biến dùng trong factory phải khai báo bằng vi.hoisted.
const { themSosVaoHangDoi } = vi.hoisted(() => ({ themSosVaoHangDoi: vi.fn() }))

const KET_QUA_SOS = {
  id: 'sos-1', type: 'flood', status: 'pending', location_estimated: false,
  created_at: '2026-10-02T08:00:00Z', cancel_deadline: '2026-10-02T08:03:00Z'
}

async function moVaGui(chonLoai: string): Promise<VueWrapper> {
  const w = mount(MapView, {
    global: {
      stubs: { MapTopBar: true, MapStats: true, MapLegend: true, SosTrackerPanel: true, AuthModal: true }
    }
  })
  await flushPromises()
  await w.find('.sos-main-btn').trigger('click')
  await w.find('select').setValue(chonLoai)
  await w.find('.sos-confirm-btn').trigger('click')
  await flushPromises()
  return w
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(guiSos).mockResolvedValue(KET_QUA_SOS as never)
  useAuthStore().setAuth({
    accessToken: 't', refreshToken: 'r',
    user: { id: 'v1', phone: '0900000001', name: 'Dân', role: 'victim', wardCode: '24781', isActive: true, createdAt: '', updatedAt: '' }
  })
})

describe('MapView — gửi SOS: toạ độ + cờ vị trí ước tính', () => {
  it('GPS tốt → gửi đúng loại + toạ độ vừa đo, locationEstimated=false, không cảnh báo', async () => {
    vi.mocked(layViTriHienTai).mockResolvedValue({ lat: 11.9404, lng: 108.4583, uocLuong: false })

    await moVaGui('landslide')

    expect(guiSos).toHaveBeenCalledTimes(1)
    expect(guiSos).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 11.9404, lng: 108.4583, type: 'landslide', locationEstimated: false })
    )
    expect(useToastStore().message).toBe('Đã gửi tín hiệu cứu trợ. Đội điều phối sẽ liên hệ sớm.')
  })

  it('GPS lỗi/kém (uocLuong=true) → VẪN gửi, kèm locationEstimated=true và toast cảnh báo vị trí ước tính', async () => {
    vi.mocked(layViTriHienTai).mockResolvedValue({ lat: 11.94, lng: 108.44, uocLuong: true })

    await moVaGui('fire')

    expect(guiSos).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 11.94, lng: 108.44, type: 'fire', locationEstimated: true })
    )
    // Cảnh báo đứng ĐẦU hàng đợi toast (đi trước toast "đã gửi") để người dùng thấy ngay.
    expect(useToastStore().message).toContain('vị trí ước tính')
  })

  it('mất mạng lúc gửi → lưu hàng đợi offline và GIỮ nguyên cờ ước tính + toạ độ', async () => {
    vi.mocked(layViTriHienTai).mockResolvedValue({ lat: 11.94, lng: 108.44, uocLuong: true })
    vi.mocked(guiSos).mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'))

    await moVaGui('medical')

    expect(themSosVaoHangDoi).toHaveBeenCalledWith(
      expect.objectContaining({ lat: 11.94, lng: 108.44, type: 'medical', locationEstimated: true })
    )
  })
})

describe('MapView — nút Vị trí của tôi', () => {
  it('có gắn ViTriCuaToi lên bản đồ của trang, tự xin vị trí (không dùng nguồn ngoài)', async () => {
    const w = mount(MapView, {
      global: { stubs: { MapTopBar: true, MapStats: true, MapLegend: true, SosTrackerPanel: true, AuthModal: true } }
    })
    await flushPromises()
    const nut = w.findComponent(ViTriCuaToi)
    expect(nut.exists()).toBe(true)
    expect(nut.props('nguonNgoai')).toBeUndefined()
  })
})
