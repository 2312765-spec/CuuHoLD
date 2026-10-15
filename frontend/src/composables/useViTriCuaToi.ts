// Nút "Vị trí của tôi" — xem mình đang ở đâu trên bản đồ mà KHÔNG phải gửi SOS.
//
// ⚠️ Vị trí ở đây CHỈ để hiển thị trên máy người dùng: không gọi API nào, không ghi vết GPS,
// không đụng payload SOS hay vị trí đội gửi mỗi 30 giây (các luồng đó giữ GPS thật, xem
// MapView.vue/RescuerView.vue). Vị trí chỉnh tay càng không được đi đâu — nó là cảm nhận của
// người dùng, không phải số đo.
//
// Có `nguonNgoai` (RescuerView đã có watchPosition cho việc gửi vị trí đội) thì dùng điểm từ
// đó, không mở watcher thứ hai: 2 watcher độ chính xác cao cùng lúc chỉ tốn pin gấp đôi.
import { ref, computed, watch, onBeforeUnmount, type Ref } from 'vue'
import L from 'leaflet'
import { taoBoLocViTri, diemTuViTriTrinhDuyet, type DiemGps } from '@/utils/locViTri'
import type { ToaDo } from '@/utils/geo'

// Mức đường phố: đủ thấy mình đứng ở ngõ nào, vẫn còn thấy vài dãy nhà xung quanh.
export const ZOOM_VI_TRI_CUA_TOI = 15
// Trên ngưỡng này báo "Độ chính xác thấp" (cùng ngưỡng cảnh báo vị trí ước tính khi gửi SOS,
// utils/geolocation.ts) — người dùng nên biết chấm xanh có thể lệch cả dãy phố.
export const NGUONG_DO_CHINH_XAC_THAP_M = 100
// Cùng mức chờ khoá vệ tinh với luồng gửi SOS (utils/geolocation.ts).
const GEOLOCATION_TIMEOUT_MS = 15000
const TUY_CHON_GPS: PositionOptions = { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }

const LOI = {
  khongAnToan:
    'Trình duyệt chặn định vị vì trang không mở bằng https://. Hãy mở lại bằng địa chỉ https:// (khi thử trên máy tính thì dùng localhost).',
  khongHoTro: 'Trình duyệt này không hỗ trợ định vị. Hãy thử Chrome hoặc Safari bản mới.',
  1: 'Bạn đã từ chối quyền vị trí. Bấm biểu tượng ổ khoá cạnh địa chỉ trang → cho phép Vị trí, rồi bấm lại nút này.',
  2: 'Không xác định được vị trí (GPS/dịch vụ định vị không khả dụng). Bật GPS (Dịch vụ vị trí) trên máy, ra chỗ thoáng rồi thử lại.',
  3: 'Quá 15 giây chưa lấy được vị trí. Ra chỗ thoáng, kiểm tra GPS đã bật rồi bấm lại.'
} as const

function thongBaoLoi(ma: number): string {
  return ma === 1 || ma === 2 || ma === 3 ? LOI[ma] : LOI[2]
}

const ICON_GHIM = L.divIcon({
  className: 'vi-tri-ghim',
  html: '<span class="vi-tri-ghim__dau"></span>',
  iconSize: [30, 40],
  iconAnchor: [15, 40]
})

export function useViTriCuaToi(map: Readonly<Ref<L.Map | null>>, nguonNgoai?: Readonly<Ref<DiemGps | null | undefined>>) {
  const daBat = ref(false)
  const dangLay = ref(false)
  const loi = ref<string | null>(null)
  // Điểm GPS thật đã qua lọc nhiễu.
  const viTri = ref<DiemGps | null>(null)
  const viTriChinhTay = ref<ToaDo | null>(null)
  const dangTheoDoi = ref(false)
  const dangChinh = ref(false)

  const viTriHienThi = computed<ToaDo | null>(() => viTriChinhTay.value ?? viTri.value)
  const doChinhXacThap = computed(() => (viTri.value?.saiSoM ?? 0) > NGUONG_DO_CHINH_XAC_THAP_M)

  const boLoc = taoBoLocViTri()
  let watchId: number | null = null
  let bayKhiCoDiem = false
  let cham: L.CircleMarker | null = null
  let vong: L.Circle | null = null
  let ghim: L.Marker | null = null

  function veViTri(): void {
    const m = map.value
    const d = viTri.value
    if (!m || !d) return
    const ll: L.LatLngExpression = [d.lat, d.lng]
    if (!cham) {
      // interactive:false — chấm/vòng chỉ để nhìn, không chặn bấm vào marker SOS bên dưới.
      vong = L.circle(ll, { radius: d.saiSoM ?? 0, color: '#2563eb', weight: 1, fillColor: '#2563eb', fillOpacity: 0.12, interactive: false })
      cham = L.circleMarker(ll, { radius: 8, color: '#ffffff', weight: 3, fillColor: '#2563eb', fillOpacity: 1, interactive: false })
      vong.addTo(m)
      cham.addTo(m)
    } else {
      cham.setLatLng(ll)
      vong?.setLatLng(ll).setRadius(d.saiSoM ?? 0)
    }
  }

  function canGiua(zoomToiThieu: boolean): void {
    const m = map.value
    const d = viTriHienThi.value
    if (!m || !d) return
    m.setView([d.lat, d.lng], zoomToiThieu ? Math.max(m.getZoom(), ZOOM_VI_TRI_CUA_TOI) : m.getZoom())
  }

  function nhanDiem(d: DiemGps): void {
    dangLay.value = false
    if (!boLoc.nhan(d).nhan) return
    loi.value = null
    viTri.value = d
    veViTri()
    if (bayKhiCoDiem) {
      bayKhiCoDiem = false
      canGiua(true)
    } else if (dangTheoDoi.value && !viTriChinhTay.value) {
      canGiua(false)
    }
  }

  function baoLoi(e: GeolocationPositionError): void {
    dangLay.value = false
    loi.value = thongBaoLoi(e.code)
  }

  // Trả false (kèm thông báo) khi trình duyệt không cho định vị — trang http:// bị chặn hẳn.
  function coTheDinhVi(): boolean {
    if (window.isSecureContext === false) {
      loi.value = LOI.khongAnToan
      return false
    }
    if (!nguonNgoai && !navigator.geolocation) {
      loi.value = LOI.khongHoTro
      return false
    }
    return true
  }

  function bamNut(): void {
    daBat.value = true
    if (viTriHienThi.value) {
      canGiua(true)
      return
    }
    if (!coTheDinhVi()) return
    bayKhiCoDiem = true
    if (nguonNgoai) {
      if (nguonNgoai.value) nhanDiem(nguonNgoai.value)
      else dangLay.value = true
      return
    }
    dangLay.value = true
    navigator.geolocation.getCurrentPosition((pos) => nhanDiem(diemTuViTriTrinhDuyet(pos)), baoLoi, TUY_CHON_GPS)
  }

  function dungWatch(): void {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId)
    watchId = null
  }

  function batTatTheoDoi(): void {
    dangTheoDoi.value = !dangTheoDoi.value
    if (!dangTheoDoi.value) {
      dungWatch()
      return
    }
    // Nguồn ngoài đã tự cập nhật — theo dõi chỉ là căn giữa theo mỗi điểm mới (watch bên dưới).
    if (nguonNgoai || !coTheDinhVi()) return
    watchId = navigator.geolocation.watchPosition((pos) => nhanDiem(diemTuViTriTrinhDuyet(pos)), baoLoi, TUY_CHON_GPS)
  }

  function batTatChinhTay(): void {
    const m = map.value
    const d = viTriHienThi.value
    if (!m || !d) return
    dangChinh.value = !dangChinh.value
    if (!dangChinh.value) {
      ghim?.dragging?.disable()
      return
    }
    if (!ghim) {
      ghim = L.marker([d.lat, d.lng], {
        icon: ICON_GHIM,
        draggable: true,
        keyboard: true,
        title: 'Vị trí chỉnh tay (kéo để sửa)',
        zIndexOffset: 1000
      }).addTo(m)
      ghim.on('dragend', () => {
        const ll = ghim?.getLatLng()
        if (ll) viTriChinhTay.value = { lat: ll.lat, lng: ll.lng }
      })
    } else {
      ghim.dragging?.enable()
    }
  }

  function boChinhTay(): void {
    ghim?.remove()
    ghim = null
    dangChinh.value = false
    viTriChinhTay.value = null
  }

  function xoaLop(): void {
    cham?.remove()
    vong?.remove()
    cham = null
    vong = null
    ghim?.remove()
    ghim = null
  }

  // Tắt hẳn: bỏ chấm, ghim, theo dõi — bảng thông tin đóng lại.
  function tat(): void {
    dungWatch()
    xoaLop()
    boLoc.xoa()
    daBat.value = false
    dangLay.value = false
    dangTheoDoi.value = false
    dangChinh.value = false
    loi.value = null
    viTri.value = null
    viTriChinhTay.value = null
    bayKhiCoDiem = false
  }

  if (nguonNgoai) {
    watch(nguonNgoai, (d) => {
      if (d && daBat.value) nhanDiem(d)
    })
  }

  // Bản đồ bị huỷ/tạo lại (VD RescuerView ẩn bản đồ khi hết nhiệm vụ): lớp cũ đã mất theo bản
  // đồ cũ — quên tham chiếu rồi vẽ lại trên bản đồ mới nếu đang có vị trí.
  watch(map, () => {
    cham = null
    vong = null
    ghim = null
    dangChinh.value = false
    viTriChinhTay.value = null
    veViTri()
  })

  onBeforeUnmount(() => {
    dungWatch()
    xoaLop()
  })

  return {
    daBat,
    dangLay,
    loi,
    viTri,
    viTriChinhTay,
    dangTheoDoi,
    dangChinh,
    doChinhXacThap,
    bamNut,
    batTatTheoDoi,
    batTatChinhTay,
    boChinhTay,
    tat
  }
}
