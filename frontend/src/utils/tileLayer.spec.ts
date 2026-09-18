import { describe, it, expect, vi } from 'vitest'
import L from 'leaflet'
import { taoLopTileNen } from './tileLayer'

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
