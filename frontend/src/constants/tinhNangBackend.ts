// Tính năng frontend ĐÃ làm xong nhưng backend CHƯA có API (CLAUDE.md Mục 15.22). Mặc định TẮT
// để người dùng không bấm vào nút chỉ nhận lỗi 404 — bật bằng biến môi trường khi B làm xong
// route tương ứng, không cần sửa code. Là hàm (không phải hằng) để test bật/tắt được bằng
// vi.stubEnv sau khi module đã nạp.

function bat(bien: string | undefined): boolean {
  return bien === 'true'
}

// PATCH /api/users/me (sửa tên) + PATCH /api/users/me/password — F-UI-01.
export function coSuaHoSo(): boolean {
  return bat(import.meta.env.VITE_BAT_SUA_HO_SO)
}

// GET /api/sos/mine/history — F-UI-02, trang /lich-su.
export function coLichSuSos(): boolean {
  return bat(import.meta.env.VITE_BAT_LICH_SU_SOS)
}

// GET /api/push/vapid-public-key + POST/DELETE /api/push/subscriptions — F-PWA-05.
export function coThongBaoDay(): boolean {
  return bat(import.meta.env.VITE_BAT_THONG_BAO_DAY)
}
