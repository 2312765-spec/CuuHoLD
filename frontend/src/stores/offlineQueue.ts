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
import { useAuthStore } from './auth.store'
import { guiSos } from '@/services/sosService'
export const useOfflineQueueStore = defineStore('offlineQueue', () => {
  const soLuongChoGui = ref(0)
  const soLuongSosChoGui = ref(0)
  const dangOffline = ref(!navigator.onLine)

  // Giữ tham chiếu đúng hàm đã addEventListener để còn gỡ được (removeEventListener cần
  // CHÍNH hàm đó, không phải một hàm mới cùng nội dung).
  let handlerOnline: (() => void) | null = null
  let handlerOffline: (() => void) | null = null

  // Cờ chống chạy chồng: hai lượt quét hàng đợi chạy song song sẽ cùng đọc ra một danh
  // sách rồi cùng gửi, tạo yêu cầu cứu hộ TRÙNG (và đốt hạn mức 5 SOS/giờ). Vẫn có thể xảy
  // ra kể cả khi chỉ còn đúng 1 listener: khoiTao() tự gọi một lượt ngay nếu đang có mạng,
  // lượt đó có thể chồng lên đúng sự kiện 'online' vừa bắn ra.
  let dangQuetHangDoiBaoCao = false
  let dangQuetHangDoiSos = false

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
    if (dangQuetHangDoiBaoCao) return
    dangQuetHangDoiBaoCao = true
    try {
      await quetHangDoiBaoCao(themLenBanDo)
    } finally {
      dangQuetHangDoiBaoCao = false
    }
  }

  async function quetHangDoiBaoCao(themLenBanDo: (baoCao: BaoCaoSuCo) => void) {
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
  // victimId do CHÍNH store gắn, không nhận từ nơi gọi: hàng đợi là thứ duy nhất cần biết
  // danh tính chủ nhân, bắt mọi nơi gọi tự nhớ đính kèm là cách chắc chắn sẽ có chỗ quên.
  async function themSosVaoHangDoi(sos: Omit<QueuedSos, 'victimId'>) {
    const victimId = useAuthStore().user?.id
    // Không xác định được chủ nhân thì THÀ báo lỗi còn hơn lưu một yêu cầu cứu hộ mà sau
    // này không ai gửi đi được (không khớp người đăng nhập nào) — im lặng lưu vào đây sẽ
    // cho người dân cảm giác an toàn giả. Đường này thực tế không tới được từ giao diện:
    // nút SOS chỉ hiện với role victim, tức đã đăng nhập.
    if (!victimId) {
      throw new Error('Không thể lưu SOS vào hàng đợi khi chưa đăng nhập')
    }
    await luuSosVaoDb({ ...sos, victimId })
    await capNhatSoLuong()
  }

  // Victim đổi ý huỷ ngay lúc SOS còn đang nằm chờ mạng (chưa từng tới server) — chỉ cần
  // xoá khỏi hàng đợi cục bộ, không có gì để gọi API huỷ vì server chưa từng biết tới nó.
  async function xoaSosKhoiHangDoi(localId: string) {
    await xoaSosKhoiDb(localId)
    await capNhatSoLuong()
  }

  // Dùng lúc MapView mount để dựng lại thẻ theo dõi + đếm ngược cho SOS đang chờ mạng sau
  // F5 (badge số đếm ở soLuongSosChoGui đã đúng sẵn qua capNhatSoLuong(), nhưng thẻ theo
  // dõi cần chính object QueuedSos để hiển thị — xem CLAUDE.md Mục 15.4, Case 2).
  // Lọc theo người đang đăng nhập: nếu không, victim B mở /map sẽ thấy thẻ theo dõi kèm
  // toạ độ SOS mà victim A lưu lúc trước trên cùng máy này.
  async function laySosDangChoGuiGanNhat(): Promise<QueuedSos | null> {
    const victimId = useAuthStore().user?.id
    if (!victimId) return null
    const list = (await layToanBoHangDoiSos()).filter((s) => s.victimId === victimId)
    if (list.length === 0) return null
    return list.reduce((moiNhat, item) => (item.taoLuc > moiNhat.taoLuc ? item : moiNhat))
  }

  // Gọi khi có mạng trở lại — gửi thật từng SOS đang chờ qua đúng API guiSos(), báo cho
  // component (qua onGuiThanhCong) biết SOS nào vừa thành công kèm kết quả thật từ server,
  // để useSos.ts cập nhật lại thẻ theo dõi/marker đang hiển thị (nếu còn đang mở /map).
  async function xuLyHangDoiSosKhiCoMang(
    onGuiThanhCong: (ketQua: CreateSosResult, goc: QueuedSos) => void
  ) {
    if (dangQuetHangDoiSos) return
    dangQuetHangDoiSos = true
    try {
      await quetHangDoiSos(onGuiThanhCong)
    } finally {
      dangQuetHangDoiSos = false
    }
  }

  async function quetHangDoiSos(
    onGuiThanhCong: (ketQua: CreateSosResult, goc: QueuedSos) => void
  ) {
    // CHỈ gửi mục của chính người đang đăng nhập. guiSos() đi qua http.ts và tự đính token
    // hiện hành, nên nếu gửi bừa cả hàng đợi thì SOS của victim A sẽ được tạo dưới danh
    // nghĩa victim B đang đăng nhập — sai người, sai số điện thoại, đội cứu hộ gọi nhầm.
    // Chưa đăng nhập thì không gửi gì cả, giữ nguyên hàng đợi chờ đúng chủ quay lại.
    const victimId = useAuthStore().user?.id
    if (!victimId) return
    const list = (await layToanBoHangDoiSos()).filter((s) => s.victimId === victimId)
    if (list.length === 0) return

    const toastStore = useToastStore()
    let soLuongThanhCong = 0

    for (const item of list) {
      // victimId phải bị loại khỏi payload: backend bật forbidNonWhitelisted (main.ts) nên
      // field lạ trong body bị từ chối thẳng 400. Danh tính đi qua JWT, không qua body.
      const { localId, taoLuc, victimId: _chuNhan, ...payload } = item
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

  // Gỡ listener đang đăng ký (nếu có). Tách riêng để dùng được cho cả 2 việc: dọn khi
  // component gọi khoiTao() unmount, và tự dọn trước khi đăng ký lượt mới.
  function huyDangKyListener(): void {
    if (handlerOnline) {
      window.removeEventListener('online', handlerOnline)
      handlerOnline = null
    }
    if (handlerOffline) {
      window.removeEventListener('offline', handlerOffline)
      handlerOffline = null
    }
  }

  // TRẢ VỀ hàm dọn dẹp — nơi gọi (MapView.vue) BẮT BUỘC gọi lại lúc onUnmounted.
  //
  // Trước đây hàm này chỉ addEventListener rồi thôi, không có đường gỡ, mà MapView gọi nó
  // MỖI LẦN mount. Khi trang chủ chưa có link SPA nào sang /map thì vô hại (mỗi lần vào
  // /map đều là tải lại trang). Từ lúc điều hướng SPA hoạt động, đi Home ↔ Map 10 lần là
  // có 10 listener chồng nhau: một sự kiện 'online' kích hoạt 10 lượt quét hàng đợi song
  // song → CÙNG MỘT SOS bị gửi nhiều lần. Ngoài ra 9 listener cũ còn giữ closure trỏ tới
  // các instance MapView đã bị huỷ, nên marker chúng vẽ ra rơi vào bản đồ không còn tồn tại.
  function khoiTao(
    themLenBanDo: (baoCao: BaoCaoSuCo) => void,
    onSosGuiThanhCong?: (ketQua: CreateSosResult, goc: QueuedSos) => void
  ): () => void {
    // Phòng hờ nếu có nơi nào gọi khoiTao() 2 lần mà quên dọn: thay listener cũ thay vì
    // chồng thêm, và luôn để callback của lần gọi MỚI NHẤT thắng (instance còn sống).
    huyDangKyListener()
    capNhatSoLuong()

    function guiLaiHangDoiNeuCoMang() {
      dangOffline.value = false
      xuLyHangDoiKhiCoMang(themLenBanDo)
      if (onSosGuiThanhCong) xuLyHangDoiSosKhiCoMang(onSosGuiThanhCong)
    }

    // Trước đây CHỈ gửi lại khi bắt được sự kiện DOM 'online' — nếu victim đóng hẳn tab lúc
    // mất mạng rồi mở lại app lúc mạng đã có sẵn (không có pha chuyển offline→online nào
    // xảy ra trong phiên mới), hàng đợi nằm im trong IndexedDB vô thời hạn tới lần mất-rồi-
    // có-mạng kế tiếp. Giờ tự kiểm tra ngay lúc khởi tạo thay vì chỉ chờ event — 2 hàm xử
    // lý hàng đợi đã tự return sớm nếu rỗng nên gọi thừa lúc không có gì để gửi cũng vô hại.
    if (navigator.onLine) guiLaiHangDoiNeuCoMang()

    handlerOnline = guiLaiHangDoiNeuCoMang
    handlerOffline = () => {
      dangOffline.value = true
    }
    window.addEventListener('online', handlerOnline)
    window.addEventListener('offline', handlerOffline)

    return huyDangKyListener
  }

  return {
    soLuongChoGui,
    soLuongSosChoGui,
    dangOffline,
    themBaoCaoVaoHangDoi,
    themSosVaoHangDoi,
    xoaSosKhoiHangDoi,
    laySosDangChoGuiGanNhat,
    khoiTao
  }
})