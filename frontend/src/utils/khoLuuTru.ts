// Đọc/ghi localStorage AN TOÀN. Ở chế độ duyệt riêng tư, khi trình duyệt chặn dữ liệu trang
// hoặc bộ nhớ đầy, truy cập localStorage có thể NÉM LỖI (SecurityError/QuotaExceededError).
// Các nơi gọi ở cấp module (useTheme, useOnboarding) chạy ngay lúc import → một lỗi ở đó làm
// trắng cả app, kể cả nút SOS. Chỉ dùng cho tuỳ chọn cá nhân (theme, cỡ chữ, đã xem hướng
// dẫn...) — mất đi thì app vẫn chạy đúng, chỉ quên lựa chọn.

export function docLocal(khoa: string): string | null {
  try {
    return localStorage.getItem(khoa)
  } catch {
    return null
  }
}

export function ghiLocal(khoa: string, giaTri: string): void {
  try {
    localStorage.setItem(khoa, giaTri)
  } catch {
    // Không lưu được — lựa chọn vẫn có hiệu lực trong phiên hiện tại.
  }
}

export function xoaLocal(khoa: string): void {
  try {
    localStorage.removeItem(khoa)
  } catch {
    // Bỏ qua — xem ghiLocal.
  }
}
