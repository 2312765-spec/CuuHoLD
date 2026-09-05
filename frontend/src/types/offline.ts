import type { BaoCaoSuCo, SosType } from './index'

// Báo cáo đang nằm trong "hàng đợi chờ gửi" — thêm localId (định danh riêng trên máy,
// KHÔNG phải id thật từ backend vì báo cáo này chưa từng tới được server) và taoLuc
// (thời điểm lưu, để có thể hiển thị "đã lưu lúc..." nếu cần sau này).
export interface QueuedBaoCao extends BaoCaoSuCo {
  localId: string
  taoLuc: string // ISO timestamp
}

// SOS THẬT đang chờ gửi vì mất mạng lúc bấm gửi — trước đây guiSos() lỗi mạng chỉ bị
// nuốt (catch rỗng), người dân tưởng đã gửi nhưng thực ra mất luôn. Giờ lưu lại để tự
// gửi ngay khi có mạng, đúng tinh thần "SOS không được phép biến mất vì mất mạng".
export interface QueuedSos {
  localId: string
  lat: number
  lng: number
  type: SosType
  description?: string
  taoLuc: string // ISO timestamp
}