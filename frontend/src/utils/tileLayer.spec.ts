import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import L from 'leaflet'
import { taoLopTileNen, datLaiCauDaoProxy } from './tileLayer'

// Tile ở toạ độ rừng Lâm Đồng (107.9, 11.75) z18 — máy chủ openstreetmap.fr/hot trả 404 THẬT
// ở đây (kiểm chứng 2026-09-18: vùng này mất tile từ z16 trở lên, z15 vẫn có).
const X = 209623
const Y = 121943
const Z = 18

function taoTile(done: L.DoneCallback) {
  const lop = taoLopTileNen()
  const coords = Object.assign(L.point(X, Y), { z: Z }) as L.Coords
  const tile = lop.createTile(coords, done)
  const img = tile.querySelector('img') as HTMLImageElement
  return { tile, img }
}

describe('taoLopTileNen — tile thiếu ở zoom sâu', () => {
  it('tải tile đúng zoom trước', () => {
    const { img } = taoTile(vi.fn())
    expect(img.src).toContain(`/hot/${Z}/${X}/${Y}.png`)
  })

  it('tile lỗi → lùi về tile cha, phóng to đúng phần tương ứng, KHÔNG báo lỗi', () => {
    const done = vi.fn()
    const { img } = taoTile(done)

    img.dispatchEvent(new Event('error'))
    expect(img.src).toContain(`/hot/${Z - 1}/${X >> 1}/${Y >> 1}.png`)
    expect(img.style.width).toBe('512px')
    expect(img.style.left).toBe(`-${(X % 2) * 256}px`)
    expect(img.style.top).toBe(`-${(Y % 2) * 256}px`)
    expect(done).not.toHaveBeenCalled()

    img.dispatchEvent(new Event('error'))
    img.dispatchEvent(new Event('error'))
    // z15 — mức có tile thật ở vùng này
    expect(img.src).toContain(`/hot/${Z - 3}/${X >> 3}/${Y >> 3}.png`)
    expect(img.style.width).toBe(`${256 * 8}px`)
    expect(img.style.left).toBe(`-${(X % 8) * 256}px`)

    img.dispatchEvent(new Event('load'))
    expect(done).toHaveBeenCalledTimes(1)
    expect(done.mock.calls[0][0]).toBeUndefined()
  })

  it('lùi hết giới hạn vẫn lỗi (mất mạng thật) → báo lỗi để hiện toast', () => {
    const done = vi.fn()
    const { img } = taoTile(done)
    for (let i = 0; i < 10 && !done.mock.calls.length; i++) img.dispatchEvent(new Event('error'))
    expect(done).toHaveBeenCalledTimes(1)
    expect(done.mock.calls[0][0]).toBeInstanceOf(Error)
  })
})

// ---------------------------------------------------------------------------
// Proxy tile qua backend (docs/tile-proxy-plan.md) — bật bằng VITE_DUNG_PROXY_TILE.
// ---------------------------------------------------------------------------
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/stores/toast', () => ({ useToastStore: () => ({ showToast: toastSpy }) }))

// Ô trung tâm Đà Lạt z13 — trong tỉnh, ngoài dải offline z8–10.
const PZ = 13
const PX = 6563
const PY = 3822

function taoTileTai(z: number, x: number, y: number, done: L.DoneCallback = vi.fn()) {
  const lop = taoLopTileNen()
  const coords = Object.assign(L.point(x, y), { z }) as L.Coords
  const tile = lop.createTile(coords, done)
  return tile.querySelector('img') as HTMLImageElement
}

describe('taoLopTileNen — proxy tile', () => {
  beforeEach(() => {
    datLaiCauDaoProxy()
    toastSpy.mockReset()
    vi.stubEnv('VITE_DUNG_PROXY_TILE', 'true')
  })
  afterEach(() => vi.unstubAllEnvs())

  it('bật cờ + tile trong tỉnh → gọi proxy của backend', () => {
    expect(taoTileTai(PZ, PX, PY).src).toContain(`/api/tiles/${PZ}/${PX}/${PY}.png`)
  })

  it('tắt cờ → gọi thẳng upstream như cũ', () => {
    vi.stubEnv('VITE_DUNG_PROXY_TILE', '')
    expect(taoTileTai(PZ, PX, PY).src).toContain(`/hot/${PZ}/${PX}/${PY}.png`)
  })

  it('tile ngoài tỉnh (Hà Nội) → gọi thẳng upstream (backend sẽ từ chối)', () => {
    expect(taoTileTai(13, 6504, 3606).src).toContain("/hot/13/6504/3606.png")
  })

  it('z8–10 vẫn lấy bộ tile offline đóng gói sẵn, không qua proxy', () => {
    expect(taoTileTai(9, 410, 238).src).toContain("/tiles/9/410/238.png")
  })

  it('proxy lỗi → thử lại ĐÚNG tile đó trực tiếp từ upstream (chưa lùi tile cha)', () => {
    const done = vi.fn()
    const img = taoTileTai(PZ, PX, PY, done)
    img.dispatchEvent(new Event('error'))
    expect(img.src).toContain(`/hot/${PZ}/${PX}/${PY}.png`)
    img.dispatchEvent(new Event('load'))
    expect(done).toHaveBeenCalledWith(undefined, expect.anything())
  })

  it('proxy lỗi VÀ upstream cũng lỗi (vùng thưa, 404 thật) → lùi tile cha, KHÔNG tính là proxy hỏng', () => {
    for (let i = 0; i < 6; i++) {
      const img = taoTileTai(PZ, PX + i, PY)
      img.dispatchEvent(new Event('error'))
      img.dispatchEvent(new Event('error'))
      expect(img.src).toContain(`/hot/${PZ - 1}/`)
    }
    expect(toastSpy).not.toHaveBeenCalled()
    expect(taoTileTai(PZ, PX, PY + 1).src).toContain('/api/tiles/')
  })

  it('4 lần proxy hỏng mà upstream vẫn tải được trong 20s → ngắt, các tile sau đi thẳng upstream + toast 1 lần', () => {
    for (let i = 0; i < 4; i++) {
      const img = taoTileTai(PZ, PX + i, PY)
      img.dispatchEvent(new Event('error'))
      img.dispatchEvent(new Event('load'))
    }
    expect(toastSpy).toHaveBeenCalledTimes(1)
    expect(taoTileTai(PZ, PX, PY + 1).src).toContain(`/hot/${PZ}/${PX}/${PY + 1}.png`)
    const img = taoTileTai(PZ, PX + 9, PY)
    img.dispatchEvent(new Event('error'))
    expect(toastSpy).toHaveBeenCalledTimes(1)
  })

  it('lỗi rải rác (quá 20s mới đủ 4 lần) → KHÔNG ngắt', () => {
    vi.useFakeTimers()
    try {
      for (let i = 0; i < 4; i++) {
        const img = taoTileTai(PZ, PX + i, PY)
        img.dispatchEvent(new Event('error'))
        img.dispatchEvent(new Event('load'))
        vi.advanceTimersByTime(8000)
      }
      expect(toastSpy).not.toHaveBeenCalled()
      expect(taoTileTai(PZ, PX, PY + 1).src).toContain('/api/tiles/')
    } finally {
      vi.useRealTimers()
    }
  })
})
