// F-UI-03 — lịch sử thông báo: lưu theo TỪNG tài khoản (F5, chuyển trang, đăng nhập lại vẫn còn),
// có giới hạn số lượng + hạn 7 ngày, tài khoản khác trên cùng máy không thấy.
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { useNotificationStore, thongBaoTheoTrangThai } from './notifications'
import { useAuthStore } from './auth.store'
import type { User } from '@/types/auth'

function nguoiDung(id: string): User {
  return { id, phone: '09', name: id, role: 'commander', wardCode: '1', isActive: true, createdAt: '', updatedAt: '' }
}
async function dangNhap(id: string) {
  useAuthStore().setAuth({ accessToken: 'a', refreshToken: 'r', user: nguoiDung(id) })
  await nextTick()
}

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActivePinia(createPinia())
})

describe('notifications store — lưu lịch sử', () => {
  it('F5 (store tạo lại) vẫn còn thông báo cũ của đúng tài khoản', async () => {
    await dangNhap('u1')
    useNotificationStore().them({ loai: 'sos-moi', tieuDe: 'Đã ghi nhận SOS mới', sosId: 's1' })
    await nextTick()

    setActivePinia(createPinia())
    await dangNhap('u1')
    const store = useNotificationStore()
    await nextTick()
    expect(store.danhSach.map((t) => t.tieuDe)).toEqual(['Đã ghi nhận SOS mới'])
  })

  it('tài khoản khác trên cùng máy không thấy thông báo của người trước', async () => {
    await dangNhap('u1')
    useNotificationStore().them({ loai: 'sos-moi', tieuDe: 'của u1' })
    await nextTick()

    await dangNhap('u2')
    await nextTick()
    expect(useNotificationStore().danhSach).toEqual([])
  })

  it('đăng xuất thì danh sách trống; đăng nhập lại thì hiện lại', async () => {
    await dangNhap('u1')
    const store = useNotificationStore()
    store.them({ loai: 'he-thong', tieuDe: 'x' })
    await nextTick()
    useAuthStore().logout()
    await nextTick()
    expect(store.danhSach).toEqual([])
    await dangNhap('u1')
    await nextTick()
    expect(store.danhSach).toHaveLength(1)
  })

  it('bỏ thông báo quá 7 ngày khi nạp lại', async () => {
    const cu = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString()
    const moi = new Date().toISOString()
    localStorage.setItem(
      'thong-bao:u1',
      JSON.stringify([
        { id: 'a', loai: 'he-thong', tieuDe: 'mới', thoiGian: moi, daDoc: true },
        { id: 'b', loai: 'he-thong', tieuDe: 'cũ', thoiGian: cu, daDoc: true }
      ])
    )
    await dangNhap('u1')
    await nextTick()
    expect(useNotificationStore().danhSach.map((t) => t.tieuDe)).toEqual(['mới'])
  })

  it('dữ liệu lưu bị hỏng thì bắt đầu danh sách trống, không làm sập app', async () => {
    localStorage.setItem('thong-bao:u1', '{hong')
    await dangNhap('u1')
    await nextTick()
    expect(useNotificationStore().danhSach).toEqual([])
  })

  it('"Xoá hết" xoá luôn bản đã lưu', async () => {
    await dangNhap('u1')
    const store = useNotificationStore()
    store.them({ loai: 'he-thong', tieuDe: 'x' })
    await nextTick()
    store.xoaTatCa()
    await nextTick()
    expect(JSON.parse(localStorage.getItem('thong-bao:u1') ?? '[]')).toEqual([])
  })
})

describe('thongBaoTheoTrangThai', () => {
  it('mỗi trạng thái có tiêu đề + biểu tượng riêng (đã cứu hộ xong, đã huỷ...)', () => {
    expect(thongBaoTheoTrangThai('resolved')).toEqual({ tieuDe: 'Đã cứu hộ xong', icon: '✅' })
    expect(thongBaoTheoTrangThai('cancelled')).toEqual({ tieuDe: 'SOS đã huỷ', icon: '❌' })
    expect(thongBaoTheoTrangThai('assigned').tieuDe).toBe('Đã phân công đội cứu hộ')
    expect(thongBaoTheoTrangThai('false_alarm').tieuDe).toBe('Xác định báo nhầm')
  })
})
