// Store thông báo trong ứng dụng (F-UI-03). Nơi gom các sự kiện real-time (SOS mới, cập
// nhật trạng thái, thông báo hệ thống) để hiện ở chuông trên header. Chỉ giữ trong RAM
// (mất khi F5) — đủ cho nhu cầu "trung tâm thông báo phiên hiện tại"; không cần backend.

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type LoaiThongBao = 'sos-moi' | 'sos-capnhat' | 'he-thong'

export interface ThongBao {
  id: string
  loai: LoaiThongBao
  tieuDe: string
  moTa?: string
  sosId?: string
  thoiGian: string // ISO
  daDoc: boolean
}

const GIOI_HAN = 50 // giữ tối đa 50 thông báo gần nhất, tránh phình RAM

export const useNotificationStore = defineStore('notifications', () => {
  const danhSach = ref<ThongBao[]>([])

  const soChuaDoc = computed(() => danhSach.value.filter((t) => !t.daDoc).length)

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