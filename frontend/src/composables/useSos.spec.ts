// Test cho phần state quan trọng nhất với victim: gửi/huỷ/theo dõi SOS. useSos.ts trước đây
// không tồn tại — MapView.vue gọi thẳng guiSos() rồi bỏ quên kết quả. Các test này khoá lại
// đúng hành vi đã thêm: lưu kết quả, lọc đúng sự kiện socket của mình, và luồng hàng đợi
// offline (gửi tạm → thay bằng dữ liệu thật khi có mạng).

import { defineComponent, h } from 'vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useSos } from './useSos'
import * as sosService from '@/services/sosService'
import type { CreateSosResult, CancelSosResult, SosRequest } from '@/types'

vi.mock('@/services/sosService', () => ({
  guiSos: vi.fn(),
  huySos: vi.fn(),
  xemChiTietSos: vi.fn(),
  xemSosDangHoatDongCuaToi: vi.fn()
}))

// useSos() gọi onUnmounted() để dọn interval polling — cần một component instance THẬT
// (không phải effectScope trần) để hook đó gắn được, nên dùng @vue/test-utils mount().
let wrapper: VueWrapper | null = null

function setupUseSos() {
  let ketQua!: ReturnType<typeof useSos>
  wrapper = mount(
    defineComponent({
      setup() {
        ketQua = useSos()
        return () => h('div')
      }
    })
  )
  return ketQua
}

const KET_QUA_MAU: CreateSosResult = {
  id: 'sos-1',
  type: 'flood',
  status: 'pending',
  ward_code: '24781',
  created_at: '2026-01-01T00:00:00.000Z',
  cancel_deadline: '2026-01-01T00:03:00.000Z',
  location_estimated: false
}

describe('useSos', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    wrapper?.unmount() // dọn interval polling, tránh rò rỉ giữa các test
    wrapper = null
  })

  it('guiYeuCauSos() lưu lại kết quả — trước đây bị bỏ qua nên victim không theo dõi được', async () => {
    vi.mocked(sosService.guiSos).mockResolvedValue(KET_QUA_MAU)
    const sos = setupUseSos()

    await sos.guiYeuCauSos({ lat: 11.9, lng: 108.4, type: 'flood' })

    expect(sos.activeSos.value).toMatchObject({
      id: 'sos-1',
      type: 'flood',
      status: 'pending',
      lat: 11.9,
      lng: 108.4
    })
    expect(sos.dangGui.value).toBe(false)
    expect(sos.dangHoatDong.value).toBe(true)
  })

  it('guiYeuCauSos() lưu lại locationEstimated từ response server (fix P0 an toàn — cảnh báo vị trí ước tính)', async () => {
    vi.mocked(sosService.guiSos).mockResolvedValue({ ...KET_QUA_MAU, location_estimated: true })
    const sos = setupUseSos()

    await sos.guiYeuCauSos({ lat: 11.94, lng: 108.44, type: 'flood', locationEstimated: true })

    expect(sos.activeSos.value?.locationEstimated).toBe(true)
  })

  it('dangHoatDong là false khi SOS đã ở trạng thái kết thúc (resolved/cancelled/false_alarm)', async () => {
    vi.mocked(sosService.guiSos).mockResolvedValue({ ...KET_QUA_MAU, status: 'resolved' })
    const sos = setupUseSos()

    await sos.guiYeuCauSos({ lat: 11.9, lng: 108.4, type: 'flood' })

    expect(sos.dangHoatDong.value).toBe(false)
  })

  it('huyYeuCauSos() cập nhật đúng trạng thái trả về từ server', async () => {
    vi.mocked(sosService.guiSos).mockResolvedValue(KET_QUA_MAU)
    const ketQuaHuy: CancelSosResult = {
      sosId: 'sos-1',
      status: 'cancelled',
      penaltyApplied: false,
      accountFlagged: false
    }
    vi.mocked(sosService.huySos).mockResolvedValue(ketQuaHuy)

    const sos = setupUseSos()
    await sos.guiYeuCauSos({ lat: 11.9, lng: 108.4, type: 'flood' })
    const result = await sos.huyYeuCauSos('mistake')

    expect(result).toEqual(ketQuaHuy)
    expect(sos.activeSos.value?.status).toBe('cancelled')
    expect(sos.dangHoatDong.value).toBe(false)
    expect(sos.dangHuy.value).toBe(false)
  })

  it('capNhatTuSocket() bỏ qua sự kiện của SOS khác, chỉ áp dụng đúng SOS đang theo dõi', async () => {
    vi.mocked(sosService.guiSos).mockResolvedValue(KET_QUA_MAU)
    const sos = setupUseSos()
    await sos.guiYeuCauSos({ lat: 11.9, lng: 108.4, type: 'flood' })

    const boQua = sos.capNhatTuSocket({
      sosId: 'sos-khac',
      status: 'assigned',
      wardCode: '24781',
      updatedAt: '2026-01-01T00:01:00.000Z'
    })
    expect(boQua).toBe(false)
    expect(sos.activeSos.value?.status).toBe('pending')

    const apDung = sos.capNhatTuSocket({
      sosId: 'sos-1',
      status: 'assigned',
      wardCode: '24781',
      updatedAt: '2026-01-01T00:01:00.000Z'
    })
    expect(apDung).toBe(true)
    expect(sos.activeSos.value?.status).toBe('assigned')
  })

  it('datSosChoGui() rồi ghiNhanKetQuaThatTuHangDoi() thay id tạm bằng dữ liệu thật (luồng hàng đợi offline)', () => {
    const sos = setupUseSos()

    sos.datSosChoGui({ localId: 'local-1', lat: 11.9, lng: 108.4, type: 'flood', locationEstimated: false })
    expect(sos.activeSos.value?.localId).toBe('local-1')
    expect(sos.activeSos.value?.status).toBe('pending')
    expect(sos.dangHoatDong.value).toBe(true)

    sos.ghiNhanKetQuaThatTuHangDoi(KET_QUA_MAU, 11.9, 108.4)

    expect(sos.activeSos.value?.id).toBe('sos-1')
    expect(sos.activeSos.value?.localId).toBeUndefined()
  })

  it('datSosChoGui() với taoLuc tính cancelDeadline từ thời điểm gốc, không phải lúc gọi lại (khôi phục sau F5)', () => {
    const sos = setupUseSos()
    // Item đã nằm trong hàng đợi offline từ 2 phút trước (còn 1 phút miễn phạt) — nếu tính
    // sai từ "bây giờ" sẽ vô tình cho thêm 3 phút mới, sai với hạn huỷ miễn phạt thật.
    const taoLuc = new Date(Date.now() - 2 * 60_000).toISOString()

    sos.datSosChoGui({ localId: 'local-1', lat: 11.9, lng: 108.4, type: 'flood', locationEstimated: true, taoLuc })

    expect(sos.activeSos.value?.locationEstimated).toBe(true)
    expect(sos.activeSos.value?.createdAt).toBe(taoLuc)
    expect(sos.activeSos.value?.cancelDeadline).toBe(
      new Date(new Date(taoLuc).getTime() + 3 * 60_000).toISOString()
    )
  })

  it('dongTheoDoi() xoá thẻ theo dõi hiện tại', async () => {
    vi.mocked(sosService.guiSos).mockResolvedValue(KET_QUA_MAU)
    const sos = setupUseSos()
    await sos.guiYeuCauSos({ lat: 11.9, lng: 108.4, type: 'flood' })

    sos.dongTheoDoi()

    expect(sos.activeSos.value).toBeNull()
  })

  // ---- Fix #2 (CLAUDE.md Mục 15.11): victim thấy đội cứu hộ đang tới ----
  const CHI_TIET_MAU: SosRequest = {
    id: 'sos-1',
    victim_id: 'victim-1',
    type: 'flood',
    status: 'assigned',
    description: null,
    image_url: null,
    ward_code: '24781',
    cancel_deadline: '2026-01-01T00:03:00.000Z',
    location_estimated: false,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:01:00.000Z',
    resolved_at: null,
    lat: 11.9,
    lng: 108.4,
    assigned_team_id: 'team-1',
    team_lat: 11.95,
    team_lng: 108.45
  }

  it('khoiPhucSosDangHoatDong() mang theo toạ độ đội được giao', async () => {
    vi.mocked(sosService.xemSosDangHoatDongCuaToi).mockResolvedValue(CHI_TIET_MAU)
    const sos = setupUseSos()

    await sos.khoiPhucSosDangHoatDong()

    expect(sos.activeSos.value).toMatchObject({ teamLat: 11.95, teamLng: 108.45 })
  })

  it('mỗi lượt poll cập nhật toạ độ đội — đội di chuyển thì marker đi theo', async () => {
    vi.useFakeTimers()
    try {
      vi.mocked(sosService.guiSos).mockResolvedValue(KET_QUA_MAU)
      vi.mocked(sosService.xemChiTietSos).mockResolvedValue({
        ...CHI_TIET_MAU,
        team_lat: 11.93,
        team_lng: 108.43
      })
      const sos = setupUseSos()
      await sos.guiYeuCauSos({ lat: 11.9, lng: 108.4, type: 'flood' })

      await vi.advanceTimersByTimeAsync(20000)

      expect(sos.activeSos.value).toMatchObject({
        status: 'assigned',
        teamLat: 11.93,
        teamLng: 108.43
      })
    } finally {
      vi.useRealTimers()
    }
  })
})
