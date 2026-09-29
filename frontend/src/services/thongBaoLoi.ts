// Chuyển lỗi từ server thành câu tiếng Việt cho người dùng. Trước đây interceptor hiện NGUYÊN VĂN
// message của NestJS — kể cả thông báo kỹ thuật tiếng Anh như "Cannot GET /api/sos/mine/history"
// (route chưa có) hay "ThrottlerException: Too Many Requests" (bấm quá nhiều lần).
// Thông báo nghiệp vụ tiếng Việt do backend tự viết thì giữ nguyên — đó là thông tin có ích.

const MAC_DINH: Record<number, string> = {
  400: 'Dữ liệu gửi lên chưa hợp lệ, vui lòng kiểm tra lại.',
  401: 'Sai thông tin đăng nhập hoặc phiên đã hết hạn.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu, hoặc chức năng này chưa có trên máy chủ.',
  409: 'Thao tác bị trùng hoặc dữ liệu vừa thay đổi, vui lòng tải lại rồi thử lại.',
  413: 'Dữ liệu gửi lên quá lớn.',
  429: 'Bạn thao tác quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.'
}

// Message mặc định của NestJS/Express/class-validator (tiếng Anh, không dấu) — không có ích cho
// người dùng. Nhận diện: không có chữ tiếng Việt có dấu VÀ khớp mẫu thông báo kỹ thuật.
const MAU_KY_THUAT =
  /Cannot (GET|POST|PUT|PATCH|DELETE)|Exception|Forbidden|Unauthorized|Not Found|Bad Request|Too Many|Internal server|must be|should not|is not|Payload Too Large/i
const CO_DAU_TIENG_VIET = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/i

// Backend chưa có global exception filter (xem docs/api-contract.md, mục "Response lỗi") —
// lỗi trả nguyên format mặc định NestJS { statusCode, message, error }, với message có thể
// là string ĐƠN hoặc MẢNG string (ValidationPipe báo nhiều lỗi validate DTO cùng lúc).
function trichMessage(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('message' in data)) return null
  const { message } = data as { message: unknown }
  if (typeof message === 'string') return message
  if (Array.isArray(message) && typeof message[0] === 'string') return message[0]
  return null
}

export function thongBaoLoiThanThien(status: number, data: unknown): string {
  const macDinh = MAC_DINH[status] ?? 'Yêu cầu không hợp lệ.'
  // 429 do bộ giới hạn tần suất sinh ra — message luôn là kỹ thuật.
  if (status === 429) return macDinh
  const msg = trichMessage(data)
  if (!msg) return macDinh
  if (!CO_DAU_TIENG_VIET.test(msg) && MAU_KY_THUAT.test(msg)) return macDinh
  return msg
}
