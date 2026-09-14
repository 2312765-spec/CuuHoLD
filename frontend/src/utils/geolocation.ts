// Bọc navigator.geolocation.getCurrentPosition thành Promise, tách khỏi MapView.vue để test
// được mà không cần mount component (theo đúng quy ước utils/geo.ts).
//
// enableHighAccuracy:true — thiếu cờ này (bug thật, xem CLAUDE.md/báo cáo 2026-09-13) khiến
// trình duyệt được phép trả vị trí định vị theo Wi-Fi/trạm phát sóng thay vì chip GPS thật,
// sai số 100-300m dù API báo "thành công". timeout tăng lên 15s vì GPS cần thời gian khoá
// vệ tinh, nhất là địa hình đồi/nhiều nhà cao tầng như Đà Lạt.
//
// accuracy threshold — trước đây pos.coords.accuracy (sai số ước tính, mét) không hề được
// đọc, nên mọi kết quả "thành công" bị coi là chính xác tuyệt đối kể cả khi sai số rất lớn.
// Giờ tái dùng đúng cờ uocLuong sẵn có (vốn chỉ bật khi lỗi hẳn) cho cả trường hợp "thành
// công nhưng không đáng tin".

export interface KetQuaViTri {
  lat: number
  lng: number
  uocLuong: boolean
}

export const TOA_DO_UOC_TINH_TAM_TINH: KetQuaViTri = { lat: 11.94, lng: 108.44, uocLuong: true }

const NGUONG_SAI_SO_CANH_BAO_M = 100
const GEOLOCATION_TIMEOUT_MS = 15000

type GeolocationGetter = Pick<Geolocation, 'getCurrentPosition'>

export function layViTriHienTai(geolocation: GeolocationGetter | undefined): Promise<KetQuaViTri> {
  return new Promise((resolve) => {
    if (!geolocation) {
      resolve(TOA_DO_UOC_TINH_TAM_TINH)
      return
    }
    geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          uocLuong: pos.coords.accuracy > NGUONG_SAI_SO_CANH_BAO_M
        })
      },
      () => resolve(TOA_DO_UOC_TINH_TAM_TINH),
      { enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS }
    )
  })
}
