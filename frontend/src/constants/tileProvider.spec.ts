// Bug thật (2026-09-13): điện thoại (~390px) mở bản đồ ở zoom 7 để vừa cả tỉnh, nhưng
// duongDanTileOffline() chỉ chặn TRÊN (z > 10) mà không chặn DƯỚI — trả `/tiles/7/...` cho
// các ô trong tỉnh, trong khi public/tiles/ chỉ có z8–10. Vite trả index.html (text/html)
// cho đường dẫn không tồn tại → ảnh hỏng → lộ màu nền đúng vùng tỉnh. Laptop 1366px mở ở
// z8+ nên chưa từng thấy. Toạ độ tile dưới đây lấy từ lần tái hiện thật.

import { describe, it, expect } from 'vitest'
import { duongDanTileOffline, TILE_URL, TILE_HOST_PATTERN } from './tileProvider'

function urlTileMau(z: number, x: number, y: number): string {
  return TILE_URL.replace('{s}', 'a').replace('{z}', String(z)).replace('{x}', String(x)).replace('{y}', String(y))
}

describe('nguồn tile nền', () => {
  it('KHÔNG trỏ vào *.openstreetmap.org — Viettel chặn cả tên miền này ở DNS (trả 127.0.0.1, kiểm chứng 2026-09-13)', () => {
    expect(new URL(urlTileMau(13, 6557, 3804)).hostname).not.toMatch(/(^|\.)openstreetmap\.org$/)
  })

  it('KHÔNG dùng tile.openstreetmap.de — trả 404 (text/html, không CORS) ở z18 tại nhiều vùng Lâm Đồng, trình duyệt báo lỗi CORS và app mất nền khi zoom hết cỡ (kiểm chứng 2026-09-13)', () => {
    expect(new URL(urlTileMau(18, 209820, 122718)).hostname).not.toBe('tile.openstreetmap.de')
  })

  it('TILE_HOST_PATTERN (cache của service worker) khớp đúng URL tile đang dùng', () => {
    expect(TILE_HOST_PATTERN.test(urlTileMau(13, 6557, 3804))).toBe(true)
  })
})

describe('duongDanTileOffline', () => {
  it('zoom 7 (dưới bộ offline) → null để gọi OSM, KHÔNG trỏ vào /tiles/7 không tồn tại — đây chính là bug', () => {
    expect(duongDanTileOffline(7, 102, 59)).toBeNull()
    expect(duongDanTileOffline(7, 102, 60)).toBeNull()
  })

  it('zoom thấp hơn nữa cũng không trỏ vào bộ offline', () => {
    expect(duongDanTileOffline(0, 0, 0)).toBeNull()
    expect(duongDanTileOffline(5, 25, 14)).toBeNull()
  })

  it('zoom 8–10 trong tỉnh → đường dẫn tile đã bundle', () => {
    expect(duongDanTileOffline(8, 204, 119)).toBe('/tiles/8/204/119.png')
    expect(duongDanTileOffline(9, 409, 239)).toBe('/tiles/9/409/239.png')
    expect(duongDanTileOffline(10, 819, 479)).toBe('/tiles/10/819/479.png')
  })

  it('zoom 11 (trên bộ offline) → null', () => {
    expect(duongDanTileOffline(11, 1638, 958)).toBeNull()
  })

  it('zoom 10 nhưng ngoài tỉnh → null', () => {
    expect(duongDanTileOffline(10, 0, 0)).toBeNull()
  })
})
