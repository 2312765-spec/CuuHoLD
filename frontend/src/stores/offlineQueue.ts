// Store điều phối hàng đợi offline — nơi DUY NHẤT biết cả IndexedDB (lưu trữ) lẫn
// mapDataStore (dữ liệu hiển thị lên bản đồ). Tự lắng nghe sự kiện online/offline
// của trình duyệt, không cần component nào phải tự gọi tay.

import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QueuedBaoCao, QueuedSos } from '@/types/offline'
import type { BaoCaoSuCo, CreateSosResult } from '@/types'
import {
  themVaoHangDoi,
  layToanBoHangDoi,
  xoaKhoiHangDoi,
  themSosVaoHangDoi as luuSosVaoDb,
  layToanBoHangDoiSos,
  xoaKhoiHangDoiSos as xoaSosKhoiDb
} from '@/utils/offlineQueue'
import { useMapDataStore } from './mapData'
import { useToastStore } from './toast'
import { guiSos } from '@/services/sosService'
export const useOfflineQueueStore = defineStore('offlineQueue', () => {
  const soLuongChoGui = ref(0)
  const soLuongSosChoGui = ref(0)
  const dangOffline = ref(!navigator.onLine)

  async function capNhatSoLuong() {
    const list = await layToanBoHangDoi()
    soLuongChoGui.value = list.length
    soLuongSosChoGui.value = (await layToanBoHangDoiSos()).length
  }

  // Gọi khi người dùng gửi báo cáo LÚC ĐANG MẤT MẠNG — lưu vào IndexedDB,
  // KHÔNG hiển thị lên bản đồ ngay (vì "báo cáo" này về bản chất chưa từng
  // được gửi đi đâu cả, chỉ đang nằm chờ trên máy người dùng).
  async function themBaoCaoVaoHangDoi(baoCao: BaoCaoSuCo) {
    const item: QueuedBaoCao = {
      ...baoCao,
      localId: crypto.randomUUID(),
      taoLuc: new Date().toISOString()
    }
    await themVaoHangDoi(item)
    await capNhatSoLuong()
  }

  // Gọi khi có mạng trở lại — duyệt qua từng báo cáo đang chờ, "gửi" (ở giai đoạn
  // chưa có backend thật: coi như gửi thành công ngay, thêm vào mapDataStore để
  // hiển thị lên bản đồ), rồi xoá khỏi hàng đợi. Khi có backend thật, thay đúng
  // đoạn "coi như gửi thành công" bằng lệnh fetch POST thật, giữ nguyên phần còn lại.
    async function xuLyHangDoiKhiCoMang(themLenBanDo: (baoCao: BaoCaoSuCo) => void) {
    const list = await layToanBoHangDoi()
    if (list.length === 0) return

    const mapDataStore = useMapDataStore()
    const toastStore = useToastStore()
    let soLuongThanhCong = 0

    for (const item of list) {
      const { localId, taoLuc, ...baoCao } = item
      void taoLuc
      try {
        // mucDo cũ ('Khẩn cấp'/'Cảnh báo') không map 1-1 sang SosType — tạm gán 'other'.
        // guiSos() trả về CreateSosResult (id/type/status/...) — KHÔNG cùng hình dạng với
        // BaoCaoSuCo (ten/lat/lng/mucDo/mau) mà bản đồ cần để vẽ marker, nên marker vẫn
        // dùng lại đúng nội dung báo cáo gốc (baoCao) người dùng đã nhập lúc mất mạng.
        await guiSos({ lat: baoCao.lat, lng: baoCao.lng, type: 'other', description: baoCao.ten })
        mapDataStore.themBaoCao(baoCao)
        themLenBanDo(baoCao)
        await xoaKhoiHangDoi(localId)
        soLuongThanhCong++
      } catch {
        // Gửi lại thất bại — giữ nguyên item trong hàng đợi, thử lại lần 'online' kế tiếp.
      }
    }

    if (soLuongThanhCong > 0) {
      toastStore.showToast(`Đã tự động gửi ${soLuongThanhCong} báo cáo lưu tạm lúc mất mạng.`)
    }
    await capNhatSoLuong()
  }

  // Gọi khi POST /api/sos thất bại vì MẤT MẠNG thật sự (không phải lỗi nghiệp vụ như
  // rate-limit hay dữ liệu sai) — lưu lại để tự gửi khi có mạng, thay vì để yêu cầu cứu
  // trợ biến mất im lặng đúng lúc người dân cần nó nhất.
  async function themSosVaoHangDoi(sos: QueuedSos) {
    await luuSosVaoDb(sos)
    await capNhatSoLuong()
  }

  // Victim đổi ý huỷ ngay lúc SOS còn đang nằm chờ mạng (chưa từng tới server) — chỉ cần
  // xoá khỏi hàng đợi cục bộ, không có gì để gọi API huỷ vì server chưa từng biết tới nó.
  async function xoaSosKhoiHangDoi(localId: string) {
    await xoaSosKhoiDb(localId)
    await capNhatSoLuong()
  }

  // Gọi khi có mạng trở lại — gửi thật từng SOS đang chờ qua đúng API guiSos(), báo cho
  // component (qua onGuiThanhCong) biết SOS nào vừa thành công kèm kết quả thật từ server,
  // để useSos.ts cập nhật lại thẻ theo dõi/marker đang hiển thị (nếu còn đang mở /map).
  async function xuLyHangDoiSosKhiCoMang(
    onGuiThanhCong: (ketQua: CreateSosResult, goc: QueuedSos) => void
  ) {
    const list = await layToanBoHangDoiSos()
    if (list.length === 0) return

    const toastStore = useToastStore()
    let soLuongThanhCong = 0

    for (const item of list) {
      const { localId, taoLuc, ...payload } = item
      void taoLuc
      try {
        const ketQua = await guiSos(payload)
        onGuiThanhCong(ketQua, item)
        await xoaSosKhoiDb(localId)
        soLuongThanhCong++
      } catch {
        // Vẫn lỗi (VD: lại mất mạng ngay, hoặc bị rate-limit) — giữ trong hàng đợi,
        // thử lại đúng lần 'online' kế tiếp thay vì mất luôn.
      }
    }

    if (soLuongThanhCong > 0) {
      toastStore.showToast(`Đã tự động gửi ${soLuongThanhCong} yêu cầu SOS đã lưu lúc mất mạng.`)
    }
    await capNhatSoLuong()
  }

  function khoiTao(
    themLenBanDo: (baoCao: BaoCaoSuCo) => void,
    onSosGuiThanhCong?: (ketQua: CreateSosResult, goc: QueuedSos) => void
  ) {
    capNhatSoLuong()

    window.addEventListener('online', () => {
      dangOffline.value = false
      xuLyHangDoiKhiCoMang(themLenBanDo)
      if (onSosGuiThanhCong) xuLyHangDoiSosKhiCoMang(onSosGuiThanhCong)
    })
    window.addEventListener('offline', () => {
      dangOffline.value = true
    })
  }

  return {
    soLuongChoGui,
    soLuongSosChoGui,
    dangOffline,
    themBaoCaoVaoHangDoi,
    themSosVaoHangDoi,
    xoaSosKhoiHangDoi,
    khoiTao
  }
})