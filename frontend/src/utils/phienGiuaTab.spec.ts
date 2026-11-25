// Chia sẻ phiên đăng nhập giữa các tab cùng trình duyệt (BroadcastChannel). Mỗi lần gọi
// moKenhPhien() đóng vai MỘT tab — BroadcastChannel không giao tin cho chính instance gửi.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { moKenhPhien, xinPhienTuTabKhac, type PhienChiaSe } from './phienGiuaTab'

const PHIEN: PhienChiaSe = {
  accessToken: 'tok',
  refreshToken: 'ref',
  user: { id: 'u1', phone: '09', name: 'A', role: 'victim', wardCode: '1', isActive: true, createdAt: '', updatedAt: '' }
}

const dongSau: Array<() => void> = []
afterEach(() => {
  while (dongSau.length) dongSau.pop()!()
  vi.unstubAllGlobals()
})

function moTab(opts: Partial<Parameters<typeof moKenhPhien>[0]> = {}) {
  const kenh = moKenhPhien({
    layPhien: () => null,
    khiNhanDangNhap: vi.fn(),
    khiNhanDangXuat: vi.fn(),
    ...opts
  })
  dongSau.push(() => kenh.dong())
  return kenh
}

describe('xinPhienTuTabKhac', () => {
  it('không có tab nào khác → null sau thời gian chờ', async () => {
    expect(await xinPhienTuTabKhac(50)).toBeNull()
  })

  it('có tab đang đăng nhập → nhận được phiên của tab đó', async () => {
    moTab({ layPhien: () => PHIEN })
    expect(await xinPhienTuTabKhac(500)).toEqual(PHIEN)
  })

  it('tab khác cũng chưa đăng nhập → không trả lời → null', async () => {
    moTab({ layPhien: () => null })
    expect(await xinPhienTuTabKhac(50)).toBeNull()
  })

  it('trình duyệt không có BroadcastChannel → null ngay, không lỗi', async () => {
    vi.stubGlobal('BroadcastChannel', undefined)
    expect(await xinPhienTuTabKhac(50)).toBeNull()
  })
})

describe('đồng bộ đăng nhập / đăng xuất', () => {
  it('tab A đăng xuất → tab B nhận tin đăng xuất', async () => {
    const tabA = moTab()
    const khiNhanDangXuat = vi.fn()
    moTab({ khiNhanDangXuat })
    tabA.phatDangXuat()
    await vi.waitFor(() => expect(khiNhanDangXuat).toHaveBeenCalledTimes(1))
  })

  it('tab A đăng nhập → tab B nhận đúng phiên', async () => {
    const tabA = moTab()
    const khiNhanDangNhap = vi.fn()
    moTab({ khiNhanDangNhap })
    tabA.phatDangNhap(PHIEN)
    await vi.waitFor(() => expect(khiNhanDangNhap).toHaveBeenCalledWith(PHIEN))
  })

  it('tab gửi KHÔNG tự nhận lại tin của chính nó (tránh vòng lặp)', async () => {
    const khiNhanDangXuat = vi.fn()
    const tabA = moTab({ khiNhanDangXuat })
    tabA.phatDangXuat()
    await new Promise((r) => setTimeout(r, 50))
    expect(khiNhanDangXuat).not.toHaveBeenCalled()
  })

  it('tin rác trên kênh bị bỏ qua', async () => {
    const khiNhanDangNhap = vi.fn()
    moTab({ khiNhanDangNhap })
    const ke = new BroadcastChannel('rescue-gis-phien')
    ke.postMessage({ loai: 'dang-nhap', phien: { accessToken: 1 } })
    ke.postMessage('chuoi la')
    await new Promise((r) => setTimeout(r, 50))
    ke.close()
    expect(khiNhanDangNhap).not.toHaveBeenCalled()
  })
})
