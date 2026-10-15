// F-PWA-04 — ghi vết GPS mỗi 2 phút, kể cả offline (chỉ ghi vào IndexedDB trên máy, không cần mạng).
import 'fake-indexeddb/auto'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useVetGpsStore, CHU_KY_GHI_MS } from './vetGps.store'
import { useAuthStore } from './auth.store'
import { xoaToanBoVetGps, layVetGps } from '@/utils/offlineQueue'

let bayGio = Date.UTC(2026, 8, 29, 7, 0)
let toaDo = { latitude: 11.94, longitude: 108.44, accuracy: 15 }
let loiGps: { code: number } | null = null

function datGps() {
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: {
      getCurrentPosition: vi.fn((ok: PositionCallback, loi: PositionErrorCallback) => {
        if (loiGps) loi(loiGps as GeolocationPositionError)
        else ok({ coords: toaDo, timestamp: bayGio } as unknown as GeolocationPosition)
      })
    }
  })
}

async function dangNhap(id = 'u1') {
  useAuthStore().setAuth({
    accessToken: 'a',
    refreshToken: 'r',
    user: { id, phone: '09', name: id, role: 'victim', wardCode: '1', isActive: true, createdAt: '', updatedAt: '' }
  })
  await nextTick()
}

beforeEach(async () => {
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
  bayGio = Date.UTC(2026, 8, 29, 7, 0)
  toaDo = { latitude: 11.94, longitude: 108.44, accuracy: 15 }
  loiGps = null
  vi.spyOn(Date, 'now').mockImplementation(() => bayGio)
  datGps()
  await xoaToanBoVetGps('u1')
  await xoaToanBoVetGps('u2')
})

describe('vetGps store', () => {
  it('bật: ghi ngay 1 điểm và nhớ lựa chọn theo từng tài khoản', async () => {
    await dangNhap()
    const store = useVetGpsStore()
    expect(store.dangBat).toBe(false)

    expect(await store.bat()).toBe(true)
    expect(store.dangBat).toBe(true)
    expect(store.soDiem).toBe(1)
    expect(localStorage.getItem('vet-gps:bat:u1')).toBe('1')

    // tài khoản khác không bị bật theo
    await dangNhap('u2')
    await nextTick()
    expect(useVetGpsStore().dangBat).toBe(false)
  })

  it('bị từ chối quyền vị trí → không bật, báo lý do', async () => {
    await dangNhap()
    loiGps = { code: 1 }
    const store = useVetGpsStore()
    expect(await store.bat()).toBe(false)
    expect(store.dangBat).toBe(false)
    expect(store.loi).toContain('quyền vị trí')
  })

  it('chỉ ghi thêm khi đã đủ 2 phút kể từ điểm trước', async () => {
    await dangNhap()
    const store = useVetGpsStore()
    await store.bat()
    bayGio += CHU_KY_GHI_MS - 1000
    await store.ghiNeuDenHan()
    expect(store.soDiem).toBe(1)
    bayGio += 2000
    await store.ghiNeuDenHan()
    expect(store.soDiem).toBe(2)
  })

  it('đang tắt thì không ghi', async () => {
    await dangNhap()
    const store = useVetGpsStore()
    await store.ghiNeuDenHan()
    expect(store.soDiem).toBe(0)
  })

  it('tự bỏ điểm cũ quá 48 giờ', async () => {
    await dangNhap()
    const store = useVetGpsStore()
    await store.bat()
    bayGio += 49 * 3600 * 1000
    await store.ghiNeuDenHan()
    expect((await layVetGps('u1')).length).toBe(1)
  })

  it('tóm tắt cho SOS: tối đa 5 điểm gần nhất trong 6 giờ, mới nhất trước, kèm giờ', async () => {
    await dangNhap()
    const store = useVetGpsStore()
    await store.bat()
    for (let i = 1; i <= 6; i++) {
      bayGio += CHU_KY_GHI_MS
      toaDo = { latitude: 11.94 + i * 0.001, longitude: 108.44, accuracy: 10 }
      await store.ghiNeuDenHan()
    }
    const tt = await store.tomTatChoSos()
    expect(tt.startsWith('Vết GPS gần nhất')).toBe(true)
    expect(tt.match(/\d+\.\d{5},\d+\.\d{5}/g)).toHaveLength(5)
    expect(tt.indexOf('11.94600')).toBeLessThan(tt.indexOf('11.94500'))

    bayGio += 7 * 3600 * 1000
    expect(await store.tomTatChoSos()).toBe('')
  })

  it('xoá vết thì mất hết điểm của người đó', async () => {
    await dangNhap()
    const store = useVetGpsStore()
    await store.bat()
    await store.xoaVet()
    expect(store.soDiem).toBe(0)
    expect(await layVetGps('u1')).toEqual([])
  })
})
