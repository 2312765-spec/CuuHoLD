// Nhớ tạm kết quả API lần trước TRONG PHIÊN (RAM, không ghi ổ đĩa — có tên/SĐT người dùng nên
// không đưa vào localStorage, CLAUDE.md Mục 4). Mở lại một trang thì hiện ngay dữ liệu cũ rồi
// tải mới ở nền, thay vì xoá trắng + "Đang tải..." mỗi lần (CLAUDE.md 15.30). Đăng xuất → xoá hết.
const kho = new Map<string, unknown>()

export function docTam<T>(khoa: string): T | undefined {
  return kho.get(khoa) as T | undefined
}

export function ghiTam<T>(khoa: string, giaTri: T): void {
  kho.set(khoa, giaTri)
}

export function xoaHetTam(): void {
  kho.clear()
}
