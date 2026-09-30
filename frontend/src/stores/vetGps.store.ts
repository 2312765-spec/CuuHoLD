// SRS F-PWA-04 — GPS breadcrumb: "Lưu tọa độ GPS vào IndexedDB mỗi 2 phút, kể cả khi offline.
// Hữu ích cho tình huống trekking mất tích." (CLAUDE.md Mục 15.x)
//
// - NGƯỜI DÙNG TỰ BẬT (mặc định tắt) ở trang Hồ sơ — ghi vị trí liên tục là dữ liệu nhạy cảm,
//   không được tự ý thu. Lựa chọn nhớ theo TỪNG tài khoản (localStorage 'vet-gps:bat:<userId>').
// - Chỉ ghi vào IndexedDB trên máy, KHÔNG gửi đi đâu — nên chạy được cả khi offline. Vết chỉ rời
//   máy khi chính người dùng gửi SOS (5 điểm gần nhất được ghép vào mô tả, xem MapView.vue).
// - Giới hạn của web (nói rõ trên giao diện): trình duyệt chỉ cho lấy GPS khi app ĐANG MỞ; đóng
//   app / khoá màn hình lâu thì ngừng ghi, mở lại sẽ ghi bù ngay 1 điểm.
// - Tự xoá điểm cũ hơn 48 giờ.

import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { useAuthStore } from './auth.store'
import { themDiemVetGps, layVetGps, xoaVetGpsCuHon, xoaToanBoVetGps } from '@/utils/offlineQueue'

export const CHU_KY_GHI_MS = 2 * 60 * 1000
const GIU_TOI_DA_MS = 48 * 60 * 60 * 1000
// Tóm tắt gửi kèm SOS: điểm quá cũ ít giá trị định vị người đang gặp nạn.
const CUA_SO_TOM_TAT_MS = 6 * 60 * 60 * 1000
const SO_DIEM_TOM_TAT = 5

function khoaBat(userId: string): string {
  return `vet-gps:bat:${userId}`
}

function layViTri(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject({ code: 2 })
      return
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 20_000,
      // Chấp nhận toạ độ cũ tới 1 phút — đỡ tốn pin, vẫn đủ mịn cho chu kỳ 2 phút.
      maximumAge: 60_000
    })
  })
}

export const useVetGpsStore = defineStore('vetGps', () => {
  const authStore = useAuthStore()
  const dangBat = ref(false)
  const soDiem = ref(0)
  const diemCuoiLuc = ref<string | null>(null)
  const loi = ref<string | null>(null)

  async function capNhatThongKe(): Promise<void> {
    const id = authStore.user?.id
    if (!id) {
      soDiem.value = 0
      diemCuoiLuc.value = null
      return
    }
    const ds = await layVetGps(id)
    soDiem.value = ds.length
    diemCuoiLuc.value = ds.length ? ds[ds.length - 1].luc : null
  }

  watch(
    () => authStore.user?.id,
    (id) => {
      dangBat.value = id ? localStorage.getItem(khoaBat(id)) === '1' : false
      loi.value = null
      void capNhatThongKe()
    },
    { immediate: true }
  )

  async function ghiMotDiem(): Promise<boolean> {
    const id = authStore.user?.id
    if (!id) return false
    try {
      const vt = await layViTri()
      await themDiemVetGps({
        userId: id,
        lat: vt.coords.latitude,
        lng: vt.coords.longitude,
        doChinhXac: Math.round(vt.coords.accuracy),
        luc: new Date(Date.now()).toISOString()
      })
      await xoaVetGpsCuHon(id, new Date(Date.now() - GIU_TOI_DA_MS).toISOString())
      loi.value = null
      await capNhatThongKe()
      return true
    } catch (e) {
      const code = (e as { code?: number })?.code
      loi.value =
        code === 1
          ? 'Trình duyệt chưa cho phép quyền vị trí, nên không ghi được vết. Hãy cho phép rồi bật lại.'
          : 'Chưa lấy được vị trí lần này — sẽ thử lại ở lần ghi kế tiếp.'
      return false
    }
  }

  // Bật = xin quyền + ghi ngay điểm đầu tiên. Không lấy được vị trí thì KHÔNG bật (tránh người
  // dùng tưởng đang được ghi vết trong khi thực tế không có điểm nào).
  async function bat(): Promise<boolean> {
    const id = authStore.user?.id
    if (!id) return false
    const ok = await ghiMotDiem()
    if (!ok) return false
    localStorage.setItem(khoaBat(id), '1')
    dangBat.value = true
    return true
  }

  // Tắt = ngừng ghi, GIỮ các điểm đã có (vẫn gửi kèm SOS được trong 6 giờ). Muốn xoá dùng xoaVet().
  function tat(): void {
    const id = authStore.user?.id
    if (id) localStorage.removeItem(khoaBat(id))
    dangBat.value = false
  }

  async function xoaVet(): Promise<void> {
    const id = authStore.user?.id
    if (!id) return
    await xoaToanBoVetGps(id)
    await capNhatThongKe()
  }

  // Gọi định kỳ (GhiVetGps.vue) và khi app được mở lại — chỉ ghi khi đang bật VÀ đã đủ 2 phút.
  async function ghiNeuDenHan(): Promise<void> {
    if (!dangBat.value) return
    const cuoi = diemCuoiLuc.value ? new Date(diemCuoiLuc.value).getTime() : 0
    if (Date.now() - cuoi < CHU_KY_GHI_MS) return
    await ghiMotDiem()
  }

  // Chuỗi ghép vào mô tả SOS — đội cứu hộ thấy người gặp nạn đã đi qua đâu trước đó. Rỗng nếu
  // không có điểm nào trong 6 giờ gần nhất.
  async function tomTatChoSos(): Promise<string> {
    const id = authStore.user?.id
    if (!id) return ''
    const moc = Date.now() - CUA_SO_TOM_TAT_MS
    const ds = (await layVetGps(id))
      .filter((d) => new Date(d.luc).getTime() >= moc)
      .slice(-SO_DIEM_TOM_TAT)
      .reverse()
    if (ds.length === 0) return ''
    const gio = (iso: string) =>
      new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
    return (
      'Vết GPS gần nhất: ' +
      ds.map((d) => `${d.lat.toFixed(5)},${d.lng.toFixed(5)} lúc ${gio(d.luc)}`).join('; ')
    )
  }

  return { dangBat, soDiem, diemCuoiLuc, loi, bat, tat, xoaVet, ghiNeuDenHan, tomTatChoSos }
})
