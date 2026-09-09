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
  // Chủ nhân thật của yêu cầu này (users.id lúc bấm gửi). BẮT BUỘC vì hàng đợi nằm trong
  // IndexedDB — sống dai hơn phiên đăng nhập. Không có trường này thì SOS mà victim A lưu
  // lúc mất mạng sẽ được gửi kèm token của BẤT KỲ ai đang đăng nhập khi mạng trở lại: A
  // đăng xuất, B đăng nhập trên cùng máy → yêu cầu của A đi dưới tên và số điện thoại của
  // B, đội cứu hộ gọi nhầm người. Store chỉ gửi/hiển thị mục khớp đúng người đang đăng nhập.
  victimId: string
  lat: number
  lng: number
  type: SosType
  description?: string
  // true nếu toạ độ chỉ là ước tính (GPS thất bại/bị từ chối quyền lúc gửi) — giữ lại qua
  // hàng đợi offline để không mất thông tin này khi gửi lại lúc có mạng.
  locationEstimated: boolean
  taoLuc: string // ISO timestamp
}