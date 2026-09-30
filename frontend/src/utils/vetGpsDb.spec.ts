// F-PWA-04 — kho vết GPS trong IndexedDB (DB v4). Chạy trên IndexedDB giả lập đầy đủ.
import 'fake-indexeddb/auto'
import { describe, it, expect } from 'vitest'
import {
  themDiemVetGps,
  layVetGps,
  xoaVetGpsCuHon,
  xoaToanBoVetGps,
  layToanBoHangDoiSos,
  themSosVaoHangDoi
} from './offlineQueue'

const gio = (h: number) => new Date(Date.UTC(2026, 8, 29, h)).toISOString()

describe('vết GPS trong IndexedDB', () => {
  it('lưu + đọc theo đúng người dùng, cũ → mới', async () => {
    await themDiemVetGps({ userId: 'u1', lat: 11.9, lng: 108.4, doChinhXac: 12, luc: gio(2) })
    await themDiemVetGps({ userId: 'u1', lat: 11.91, lng: 108.41, doChinhXac: 20, luc: gio(1) })
    await themDiemVetGps({ userId: 'u2', lat: 12, lng: 108, doChinhXac: 5, luc: gio(1) })

    const ds = await layVetGps('u1')
    expect(ds.map((d) => d.luc)).toEqual([gio(1), gio(2)])
    expect(ds.every((d) => d.userId === 'u1')).toBe(true)
  })

  it('xoá điểm cũ hơn mốc chỉ của người đó; xoá toàn bộ chỉ của người đó', async () => {
    await xoaVetGpsCuHon('u1', gio(2))
    expect((await layVetGps('u1')).map((d) => d.luc)).toEqual([gio(2)])
    expect(await layVetGps('u2')).toHaveLength(1)

    await xoaToanBoVetGps('u1')
    expect(await layVetGps('u1')).toEqual([])
    expect(await layVetGps('u2')).toHaveLength(1)
  })

  it('nâng DB lên v4 không làm hỏng hàng đợi SOS sẵn có', async () => {
    await themSosVaoHangDoi({
      localId: 'x', victimId: 'u1', lat: 1, lng: 2, type: 'flood', locationEstimated: false, taoLuc: gio(0)
    })
    expect((await layToanBoHangDoiSos()).map((s) => s.localId)).toEqual(['x'])
  })
})
