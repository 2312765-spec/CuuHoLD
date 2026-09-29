// Store thông báo trong ứng dụng (F-UI-03). Nơi gom các sự kiện real-time (SOS mới, cập nhật
// trạng thái, thông báo hệ thống) để hiện ở chuông trên header.
//
// Lưu LỊCH SỬ theo TỪNG tài khoản vào localStorage (khoá 'thong-bao:<userId>'): F5, chuyển trang,
// đóng mở trình duyệt rồi đăng nhập lại vẫn thấy — trước đây chỉ giữ trong RAM nên F5 là mất sạch.
// Tài khoản khác trên cùng máy không thấy (khoá khác nhau). Chỉ giữ 100 thông báo gần nhất và
// bỏ cái quá 7 ngày: thông báo có tên nạn nhân — không để tồn đọng vô hạn trên máy dùng chung.

import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { useAuthStore } from './auth.store'
import type { SosStatus } from '@/types'

export type LoaiThongBao = 'sos-moi' | 'sos-capnhat' | 'he-thong'

export interface ThongBao {
  id: string
  loai: LoaiThongBao
  tieuDe: string
  moTa?: string
  sosId?: string
  icon?: string
  thoiGian: string // ISO
  daDoc: boolean
}

const GIOI_HAN = 100
const HAN_LUU_MS = 7 * 24 * 60 * 60 * 1000

// Tiêu đề + biểu tượng riêng cho từng trạng thái SOS, để lịch sử đọc được ngay "đã cứu hộ
// xong", "đã huỷ"... thay vì một dòng chung chung "Cập nhật trạng thái SOS".
const THEO_TRANG_THAI: Record<SosStatus, { tieuDe: string; icon: string }> = {
  pending: { tieuDe: 'Đã ghi nhận SOS', icon: '🆘' },
  assigned: { tieuDe: 'Đã phân công đội cứu hộ', icon: '🚑' },
  in_progress: { tieuDe: 'Đội cứu hộ đang di chuyển', icon: '🚗' },
  arrived: { tieuDe: 'Đội cứu hộ đã tới nơi', icon: '📍' },
  resolved: { tieuDe: 'Đã cứu hộ xong', icon: '✅' },
  cancelled: { tieuDe: 'SOS đã huỷ', icon: '❌' },
  false_alarm: { tieuDe: 'Xác định báo nhầm', icon: '⚠️' }
}

export function thongBaoTheoTrangThai(st: SosStatus): { tieuDe: string; icon: string } {
  return THEO_TRANG_THAI[st] ?? { tieuDe: 'Cập nhật trạng thái SOS', icon: '🔄' }
}

function khoa(userId: string): string {
  return `thong-bao:${userId}`
}

function docDaLuu(userId: string): ThongBao[] {
  try {
    const ds = JSON.parse(localStorage.getItem(khoa(userId)) ?? '[]') as ThongBao[]
    if (!Array.isArray(ds)) return []
    const moc = Date.now() - HAN_LUU_MS
    return ds.filter((t) => new Date(t.thoiGian).getTime() >= moc).slice(0, GIOI_HAN)
  } catch {
    // Dữ liệu hỏng (sửa tay, phiên bản cũ) — bắt đầu lại, không làm sập app.
    return []
  }
}

function ghiLai(userId: string, ds: ThongBao[]): void {
  try {
    localStorage.setItem(khoa(userId), JSON.stringify(ds))
  } catch {
    // Bộ nhớ đầy / chế độ riêng tư chặn ghi — vẫn dùng được trong phiên, chỉ không lưu lâu.
  }
}

export const useNotificationStore = defineStore('notifications', () => {
  const authStore = useAuthStore()
  const danhSach = ref<ThongBao[]>([])

  const soChuaDoc = computed(() => danhSach.value.filter((t) => !t.daDoc).length)

  // Đổi tài khoản (đăng nhập/đăng xuất/đổi người) → nạp đúng lịch sử của người đó.
  watch(
    () => authStore.user?.id,
    (id) => {
      danhSach.value = id ? docDaLuu(id) : []
    },
    { immediate: true }
  )

  watch(
    danhSach,
    (ds) => {
      const id = authStore.user?.id
      if (id) ghiLai(id, ds)
    },
    { deep: true }
  )

  function them(tb: Omit<ThongBao, 'id' | 'thoiGian' | 'daDoc'>): void {
    danhSach.value.unshift({
      ...tb,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      thoiGian: new Date().toISOString(),
      daDoc: false
    })
    if (danhSach.value.length > GIOI_HAN) danhSach.value.length = GIOI_HAN
  }

  function danhDauDaDoc(id: string): void {
    const tb = danhSach.value.find((t) => t.id === id)
    if (tb) tb.daDoc = true
  }

  function danhDauTatCa(): void {
    danhSach.value.forEach((t) => (t.daDoc = true))
  }

  function xoaTatCa(): void {
    danhSach.value = []
  }

  return { danhSach, soChuaDoc, them, danhDauDaDoc, danhDauTatCa, xoaTatCa }
})
