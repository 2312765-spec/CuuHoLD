// Test vòng đời listener của hàng đợi offline.
//
// Khoá lại một lỗi thật: khoiTao() trước đây addEventListener('online') mà không có đường
// gỡ, trong khi MapView.vue gọi nó MỖI LẦN mount. Lúc trang chủ chưa có link SPA sang /map
// thì vô hại (mỗi lần vào /map đều tải lại trang), nhưng khi điều hướng SPA hoạt động thì
// đi Home ↔ Map nhiều lần làm listener chồng nhau → một sự kiện 'online' kích hoạt nhiều
// lượt quét song song → CÙNG MỘT SOS bị gửi nhiều lần (yêu cầu cứu hộ trùng + đốt hạn mức
// 5 SOS/giờ). Test ở đây kiểm đúng 3 tính chất chống lại chuyện đó.

import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useOfflineQueueStore } from './offlineQueue'
import { useAuthStore } from './auth.store'
import * as db from '@/utils/offlineQueue'
import * as sosService from '@/services/sosService'
import type { QueuedSos } from '@/types/offline'
import type { CreateSosResult } from '@/types'
import type { User } from '@/types/auth'

// IndexedDB không tồn tại trong jsdom — mock toàn bộ tầng lưu trữ.
vi.mock('@/utils/offlineQueue', () => ({
  themVaoHangDoi: vi.fn(),
  layToanBoHangDoi: vi.fn(),
  xoaKhoiHangDoi: vi.fn(),
  themSosVaoHangDoi: vi.fn(),
  layToanBoHangDoiSos: vi.fn(),
  xoaKhoiHangDoiSos: vi.fn()
}))

vi.mock('@/services/sosService', () => ({ guiSos: vi.fn() }))

const layHangDoi = vi.mocked(db.layToanBoHangDoi)
const layHangDoiSos = vi.mocked(db.layToanBoHangDoiSos)
const guiSos = vi.mocked(sosService.guiSos)

// Cho các promise trong hàng đợi microtask chạy hết (không có timer nào cần chờ).
const doiXongViec = () => new Promise((r) => setTimeout(r, 0))

function dangNhapGia(id: string): void {
  const user: User = {
    id,
    phone: '0900000001',
    name: 'Victim ' + id,
    role: 'victim',
    wardCode: '24781',
    isActive: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z'
  }
  useAuthStore().setAuth({ accessToken: 'token-' + id, refreshToken: 'refresh-' + id, user })
}

function taoSosChoGui(overrides: Partial<QueuedSos> = {}): QueuedSos {
  return {
    localId: 'local-1',
    victimId: 'victim-A',
    lat: 11.94,
    lng: 108.44,
    type: 'flood',
    description: 'test',
    locationEstimated: false,
    taoLuc: new Date().toISOString(),
    ...overrides
  }
}

let donDep: (() => void) | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  sessionStorage.clear()
  layHangDoi.mockResolvedValue([])
  layHangDoiSos.mockResolvedValue([])
})

afterEach(() => {
  donDep?.()
  donDep = null
})

describe('offlineQueueStore — vòng đời listener', () => {
  it('gọi khoiTao() nhiều lần KHÔNG làm listener chồng nhau', async () => {
    // Cần đăng nhập: nhánh quét hàng đợi SOS thoát sớm khi không có người dùng, nên nếu
    // không có phiên thì layHangDoiSos không phản ánh được số lượt quét đã chạy.
    dangNhapGia('victim-A')
    const store = useOfflineQueueStore()
    // Mô phỏng vào /map → rời đi → vào lại /map mà quên dọn (3 lần mount).
    store.khoiTao(vi.fn(), vi.fn())
    store.khoiTao(vi.fn(), vi.fn())
    donDep = store.khoiTao(vi.fn(), vi.fn())

    await doiXongViec()
    vi.clearAllMocks()
    layHangDoi.mockResolvedValue([])
    layHangDoiSos.mockResolvedValue([])

    window.dispatchEvent(new Event('online'))
    await doiXongViec()

    // Một sự kiện 'online' phải quét hàng đợi đúng MỘT lượt, dù đã khoiTao 3 lần.
    expect(layHangDoi).toHaveBeenCalledTimes(1)
    expect(layHangDoiSos).toHaveBeenCalledTimes(1)
  })

  it('hàm dọn dẹp trả về gỡ hẳn listener', async () => {
    dangNhapGia('victim-A')
    const store = useOfflineQueueStore()
    const huy = store.khoiTao(vi.fn(), vi.fn())

    await doiXongViec()
    huy()
    vi.clearAllMocks()

    window.dispatchEvent(new Event('online'))
    await doiXongViec()

    expect(layHangDoi).not.toHaveBeenCalled()
    expect(layHangDoiSos).not.toHaveBeenCalled()
  })

  it('hai lượt quét chồng nhau chỉ gửi SOS đang chờ MỘT lần', async () => {
    dangNhapGia('victim-A')
    layHangDoiSos.mockResolvedValue([taoSosChoGui({ victimId: 'victim-A' })])

    // Giữ guiSos treo lơ lửng để lượt quét thứ nhất chưa kịp xong khi lượt hai bắt đầu.
    let ketThucGui: (v: CreateSosResult) => void = () => {}
    guiSos.mockReturnValue(
      new Promise<CreateSosResult>((r) => {
        ketThucGui = r
      })
    )

    const store = useOfflineQueueStore()
    donDep = store.khoiTao(vi.fn(), vi.fn()) // navigator.onLine=true trong jsdom → quét lượt 1
    await doiXongViec()

    window.dispatchEvent(new Event('online')) // lượt 2 chồng lên khi lượt 1 còn đang chờ
    await doiXongViec()

    expect(guiSos).toHaveBeenCalledTimes(1)

    ketThucGui({ id: 'sos-1', type: 'flood', status: 'pending', ward_code: '24781',
      created_at: '', cancel_deadline: '', location_estimated: false })
    await doiXongViec()
  })
})

// Hàng đợi nằm trong IndexedDB nên sống dai hơn phiên đăng nhập. guiSos() lại đi qua
// http.ts và tự đính token ĐANG hiện hành — nên nếu không lọc theo chủ nhân, SOS victim A
// lưu lúc mất mạng sẽ được tạo dưới danh nghĩa victim B đăng nhập sau đó trên cùng máy.
describe('offlineQueueStore — hàng đợi gắn với đúng chủ nhân', () => {
  const KET_QUA: CreateSosResult = {
    id: 'sos-1', type: 'flood', status: 'pending', ward_code: '24781',
    created_at: '', cancel_deadline: '', location_estimated: false
  }

  it('KHÔNG gửi SOS của người khác khi tài khoản khác đang đăng nhập', async () => {
    dangNhapGia('victim-B')
    layHangDoiSos.mockResolvedValue([taoSosChoGui({ victimId: 'victim-A' })])
    guiSos.mockResolvedValue(KET_QUA)

    const store = useOfflineQueueStore()
    donDep = store.khoiTao(vi.fn(), vi.fn())
    await doiXongViec()

    expect(guiSos).not.toHaveBeenCalled()
  })

  it('KHÔNG gửi gì khi chưa đăng nhập — giữ hàng đợi chờ đúng chủ quay lại', async () => {
    layHangDoiSos.mockResolvedValue([taoSosChoGui({ victimId: 'victim-A' })])
    guiSos.mockResolvedValue(KET_QUA)

    const store = useOfflineQueueStore()
    donDep = store.khoiTao(vi.fn(), vi.fn())
    await doiXongViec()

    expect(guiSos).not.toHaveBeenCalled()
    expect(db.xoaKhoiHangDoiSos).not.toHaveBeenCalled()
  })

  it('payload gửi lên KHÔNG kèm victimId (backend bật forbidNonWhitelisted → 400)', async () => {
    dangNhapGia('victim-A')
    layHangDoiSos.mockResolvedValue([taoSosChoGui({ victimId: 'victim-A' })])
    guiSos.mockResolvedValue(KET_QUA)

    const store = useOfflineQueueStore()
    donDep = store.khoiTao(vi.fn(), vi.fn())
    await doiXongViec()

    expect(guiSos).toHaveBeenCalledTimes(1)
    const payload = guiSos.mock.calls[0][0]
    expect(payload).not.toHaveProperty('victimId')
    expect(payload).not.toHaveProperty('localId')
    expect(payload).not.toHaveProperty('taoLuc')
    expect(payload).toMatchObject({ lat: 11.94, lng: 108.44, type: 'flood' })
  })

  it('themSosVaoHangDoi() tự gắn victimId của người đang đăng nhập', async () => {
    dangNhapGia('victim-A')
    const store = useOfflineQueueStore()

    await store.themSosVaoHangDoi({
      localId: 'local-9', lat: 11.9, lng: 108.4, type: 'medical',
      locationEstimated: false, taoLuc: '2026-01-01T00:00:00.000Z'
    })

    expect(db.themSosVaoHangDoi).toHaveBeenCalledWith(
      expect.objectContaining({ localId: 'local-9', victimId: 'victim-A' })
    )
  })

  it('themSosVaoHangDoi() từ chối lưu khi chưa đăng nhập, thay vì tạo mục vô chủ', async () => {
    const store = useOfflineQueueStore()

    await expect(
      store.themSosVaoHangDoi({
        localId: 'local-9', lat: 11.9, lng: 108.4, type: 'medical',
        locationEstimated: false, taoLuc: '2026-01-01T00:00:00.000Z'
      })
    ).rejects.toThrow(/chưa đăng nhập/)
    expect(db.themSosVaoHangDoi).not.toHaveBeenCalled()
  })

  it('laySosDangChoGuiGanNhat() chỉ trả SOS của chính người đang đăng nhập', async () => {
    dangNhapGia('victim-B')
    layHangDoiSos.mockResolvedValue([
      taoSosChoGui({ localId: 'cua-A', victimId: 'victim-A', taoLuc: '2026-01-02T00:00:00.000Z' }),
      taoSosChoGui({ localId: 'cua-B', victimId: 'victim-B', taoLuc: '2026-01-01T00:00:00.000Z' })
    ])

    const store = useOfflineQueueStore()
    const ketQua = await store.laySosDangChoGuiGanNhat()

    // Mục của A mới hơn nhưng KHÔNG được trả về — nếu không sẽ lộ toạ độ SOS của A cho B.
    expect(ketQua?.localId).toBe('cua-B')
  })
})
