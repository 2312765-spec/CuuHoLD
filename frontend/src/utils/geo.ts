// Khoảng cách + ETA phía client cho RescuerView (đường chim bay từ vị trí đội tới nạn nhân).
// Công thức ETA khớp backend GisService.findNearestTeams(): ROUND(km / 40 * 60), tốc độ giả
// định 40 km/h theo SRS F-GIS-01. Khoảng cách dùng haversine (mặt cầu) — backend dùng
// ST_Distance trên geography (ellipsoid), lệch nhau dưới 0.5%, không đáng kể ở mức hiển thị.

export interface ToaDo {
  lat: number
  lng: number
}

const BAN_KINH_TRAI_DAT_M = 6371000
const TOC_DO_GIA_DINH_KMH = 40

export function khoangCachMet(a: ToaDo, b: ToaDo): number {
  const rad = (doDo: number): number => (doDo * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * BAN_KINH_TRAI_DAT_M * Math.asin(Math.sqrt(h))
}

// Tối thiểu 1 phút — "~0 phút" đọc như đã tới nơi, trong khi trạng thái "đã đến" là do
// rescuer tự bấm, không suy ra từ khoảng cách.
export function etaPhut(met: number): number {
  return Math.max(1, Math.round((met / 1000 / TOC_DO_GIA_DINH_KMH) * 60))
}
