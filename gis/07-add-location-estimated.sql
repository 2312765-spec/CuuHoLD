-- gis/07-add-location-estimated.sql
-- Hiện thực fix P0 (CLAUDE.md Mục 15, audit 2026-09-06): trước đây khi trình duyệt từ chối
-- quyền định vị / GPS timeout, frontend ÂM THẦM thay bằng toạ độ tâm tỉnh Lâm Đồng và gửi đi
-- như thể đó là vị trí thật — nạn nhân, rescuer, commander không ai biết vị trí không chính
-- xác. Cột này cho phép ghi nhận + hiển thị cảnh báo khi toạ độ là ước tính, không phải GPS
-- thật. Chạy SAU 01-04.

ALTER TABLE public.sos_requests
  ADD COLUMN IF NOT EXISTS location_estimated BOOLEAN NOT NULL DEFAULT false;
