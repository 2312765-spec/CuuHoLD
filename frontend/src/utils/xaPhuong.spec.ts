// Danh sách xã/phường dựng từ file ranh giới: tên + khung bao đúng, thứ tự [kinh, vĩ] của GeoJSON
// đổi đúng sang [vĩ, kinh] của Leaflet, tìm không dấu, lỗi tải không làm sập.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { boDau, dungDanhSachXa, taiDanhSachXa, tenDayDu } from './xaPhuong'

const GEOJSON = {
  type: 'FeatureCollection',
  features: [
    {
      properties: { ma_xa: '24778', ten_xa: 'Lâm Viên - Đà Lạt', loai: 'Phường' },
      geometry: {
        type: 'Polygon',
        coordinates: [[[108.4, 11.9], [108.5, 11.9], [108.5, 12.0], [108.4, 11.9]]]
      }
    },
    {
      properties: { ma_xa: 24823, ten_xa: '1 Bảo Lộc', loai: 'Phường' },
      geometry: {
        type: 'MultiPolygon',
        coordinates: [
          [[[107.8, 11.5], [107.9, 11.5], [107.8, 11.6], [107.8, 11.5]]],
          [[[107.7, 11.4], [107.75, 11.45], [107.7, 11.4]]]
        ]
      }
    },
    { properties: { ma_xa: '1', ten_xa: '' }, geometry: { type: 'Polygon', coordinates: [] } }
  ]
}

describe('dungDanhSachXa', () => {
  it('lấy mã + tên + loại, bỏ feature thiếu tên, xếp theo tên tiếng Việt', () => {
    const ds = dungDanhSachXa(GEOJSON)
    expect(ds.map((x) => x.ma)).toEqual(['24823', '24778'])
    expect(tenDayDu(ds[1])).toBe('Phường Lâm Viên - Đà Lạt')
  })

  it('khung bao là [[nam, tây], [bắc, đông]] — vĩ độ trước, gồm mọi mảnh của MultiPolygon', () => {
    const [baoLoc, lamVien] = dungDanhSachXa(GEOJSON)
    expect(lamVien.khung).toEqual([
      [11.9, 108.4],
      [12.0, 108.5]
    ])
    expect(baoLoc.khung).toEqual([
      [11.4, 107.7],
      [11.6, 107.9]
    ])
  })

  it('dữ liệu hỏng → mảng rỗng, không ném lỗi', () => {
    expect(dungDanhSachXa(null)).toEqual([])
    expect(dungDanhSachXa({ features: 'x' })).toEqual([])
  })
})

describe('boDau', () => {
  it('gõ không dấu vẫn khớp', () => {
    expect(boDau('Lâm Viên - Đà Lạt')).toBe('lam vien - da lat')
    expect(boDau('Đặc khu Phú Quý')).toContain('dac khu phu quy')
  })
})

describe('taiDanhSachXa', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('mất mạng → trả rỗng, lần sau thử lại được (không nhớ lời hứa hỏng)', async () => {
    const fetchGia = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      ok: true,
      json: async () => GEOJSON
    })
    vi.stubGlobal('fetch', fetchGia)
    expect(await taiDanhSachXa()).toEqual([])
    expect((await taiDanhSachXa()).length).toBe(2)
    expect(fetchGia).toHaveBeenCalledTimes(2)
  })
})
