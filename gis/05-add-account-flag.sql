-- gis/05-add-account-flag.sql
-- Hiện thực quy tắc ở CLAUDE.md Mục 10: "3 lần huỷ SOS trễ (sau cancel_deadline)
-- → tài khoản bị flag". Trước migration này, sos_requests.false_alarm_count tồn
-- tại nhưng không bao giờ được tăng, và users không có cột đếm/cờ nào — xem
-- CLAUDE.md Mục 15.1. Chạy SAU 01-04.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS late_cancel_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_flagged BOOLEAN NOT NULL DEFAULT false;

-- Lưu ý: sos_requests.false_alarm_count vẫn giữ nguyên ý nghĩa cũ (đếm trên
-- CHÍNH request đó, không phải trên tài khoản) — SosService.cancel() tăng cột
-- này lên 1 khi huỷ trễ, còn 2 cột mới ở trên mới là bộ đếm/cờ theo tài khoản
-- dùng để quyết định flag.
