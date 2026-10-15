// Tính năng cần API backend (CLAUDE.md Mục 15.22). Backend đã có từ Mục 15.24, nhưng mặc định
// vẫn TẮT để bản frontend này chạy được cả với backend cũ chưa có route (bấm vào chỉ nhận 404) —
// bật bằng biến môi trường lúc build (xem frontend/.env.example), không cần sửa code. Là hàm (không phải hằng) để test bật/tắt được bằng
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
