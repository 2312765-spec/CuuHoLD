// Truy cập camera thiết bị (getUserMedia) cho form báo cáo sạt lở: ảnh minh chứng PHẢI chụp trực
// tiếp tại hiện trường — app cố ý không có đường chọn ảnh có sẵn trong thư viện. Phần phân loại
// lỗi tách riêng ra đây (thuần hàm) để test được mà không cần camera thật.

export type LoiCamera =
  | 'khong_an_toan'
  | 'khong_ho_tro'
  | 'bi_tu_choi'
  | 'khong_co_camera'
  | 'dang_duoc_dung'
  | 'khac'

export const THONG_BAO_LOI_CAMERA: Record<LoiCamera, string> = {
  khong_an_toan:
    'Trình duyệt chỉ cho dùng camera trên kết nối bảo mật. Hãy mở trang bằng địa chỉ https:// rồi thử lại.',
  khong_ho_tro:
    'Trình duyệt này không hỗ trợ camera. Hãy mở trang bằng Chrome hoặc Safari (không mở trong ứng dụng Zalo/Facebook).',
  bi_tu_choi:
    'Bạn chưa cho phép truy cập camera. Hãy bấm biểu tượng ổ khoá/camera cạnh thanh địa chỉ, chọn "Cho phép" Camera rồi bấm "Thử lại". Cần camera để chụp ảnh hiện trường thì mới gửi được báo cáo.',
  khong_co_camera:
    'Thiết bị này không có camera. Hãy dùng điện thoại tại hiện trường để báo cáo.',
  dang_duoc_dung:
    'Camera đang được ứng dụng khác sử dụng. Hãy đóng ứng dụng đó rồi bấm "Thử lại".',
  khac: 'Không mở được camera. Hãy bấm "Thử lại".'
}

interface NavigatorCoCamera {
  mediaDevices?: { getUserMedia?: unknown }
}

// Lý do KHÔNG thể dùng camera ngay từ đầu (null = có thể thử). getUserMedia chỉ tồn tại trên
// ngữ cảnh bảo mật (HTTPS hoặc localhost) — trên http:// thường navigator.mediaDevices là undefined.
export function kiemTraHoTroCamera(
  nav: NavigatorCoCamera,
  laNguCanhBaoMat: boolean
): LoiCamera | null {
  if (typeof nav.mediaDevices?.getUserMedia === 'function') return null
  return laNguCanhBaoMat ? 'khong_ho_tro' : 'khong_an_toan'
}

export function phanLoaiLoiCamera(loi: unknown): LoiCamera {
  const ten = typeof loi === 'object' && loi !== null && 'name' in loi ? String(loi.name) : ''
  switch (ten) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'bi_tu_choi'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'khong_co_camera'
    case 'NotReadableError':
    case 'TrackStartError':
    case 'AbortError':
      return 'dang_duoc_dung'
    default:
      return 'khac'
  }
}
